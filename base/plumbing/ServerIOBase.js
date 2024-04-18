/** 
 * Wrapper for server calls.
 * This exports the same object as ServerIO.js -- it provides a generic base which ServerIO.js builds on.
 */
import _ from 'lodash';
import $ from 'jquery';
import { assert, assMatch, setAssertFailed } from '../utils/assert';
import C from '../CBase.js';
import {encURI, getDomain, is} from '../utils/miscutils';

import Login from '../youagain';

// Try to avoid using this for modularity!
import {notifyUser} from './Messaging';

const ServerIO = {};
export default ServerIO;
// for debug
window.ServerIO = ServerIO;

// Allow for local to point at live for debugging
ServerIO.APIBASE = ''; // Normally use this! -- but ServerIO.js may override for testing

/**
 * ServerIO.checkBase expects sites to have their own backend at the same domain
 * - so ServerIO.APIBASE === '' is prod on a prod server, test on a test server, local on local.
 * Basically: set this true for "empty APIBASE isn't the correct value for prod"
 */
ServerIO.NO_API_AT_THIS_HOST = false;

// Init ENDPOINTS for typescript ??
ServerIO.DATALOG_ENDPOINT = '';
ServerIO.MEDIA_ENDPOINT = '';
ServerIO.API_ENDPOINT = '';

// const SOGIVE_SUBDOMAIN = { '': 'app', test: 'test', local: 'test', stage: 'stage'}[C.SERVER_TYPE];
// const SOGIVE_PROTOCOL = { app: 'https', test: 'https', local: 'http', stage: 'https'}[SOGIVE_SUBDOMAIN];
// ServerIO.ENDPOINT_NGO = `${SOGIVE_PROTOCOL}://${SOGIVE_SUBDOMAIN}portal.good-loop.com/ngo`;
ServerIO.ENDPOINT_TASK = 'https://calstat.good-loop.com/task';

/** Endpoints for checkBase to inspect - expand as necessary. This is NOT used by ajax calls.
// "name" is just a human-readable designation for logging. "key" is the field in ServerIO to check.
// "prodValue" is the expected / forcibly-reset-to-this value that production servers should have.
 */ 
const endpoints = [
	{name: 'base API', key: 'APIBASE', prodValue: ''},
	{name: 'DataLog', key: 'DATALOG_ENDPOINT', base: 'lg.good-loop.com/data'},
	/** Where uploads go */
	{name: 'Media', key: 'MEDIA_ENDPOINT', base: 'uploads.good-loop.com'},
	{name: 'API', key: 'API_ENDPOINT', base: 'api.good-loop.com/v0'},
];
// set defaults
endpoints.forEach(e => {
	if (e.base) {
		ServerIO[e.key] = `${C.HTTPS}://${C.SERVER_TYPE}${e.base}`;
		e.prodValue = 'https://'+e.base;
	} else {
		ServerIO[e.key] = e.prodValue;
	}
});

/**
 * Call this from app-specific ServerIO.js 
 * Safety check - if we deploy test code, it will complain.
 */
ServerIO.checkBase = () => {
	// Setup endpoint etc overrides given in host-specific config file
	// "process" is a weird global whose parts actually get inlined at compile time.
	// Code which checks for the root "process" to exist will fail - even when code using
	// e.g. process.env.SERVERIO_OVERRIDES finds a usable value.
	// So instead of trying to determine if it exists, just swallow errors when it doesn't.
	try {
		if (process.env.CONFIG_FILE) {
			const { ServerIOOverrides } = require(process.env.CONFIG_FILE);
			// const ServerIOOverrides = process.env.SERVERIO_OVERRIDES; // NB: see webpack.config.js for how this is set
			if (ServerIOOverrides) {
				Object.entries(ServerIOOverrides).forEach(([key, val]) => {
					ServerIO[key] = val;
					console.log('SERVERIOOVERRIDE', key, val);
				});
			}
		}
	} catch (e) {} // Ignore "process is undefined" etc errors

	endpoints.forEach(({name, key, prodValue}) => {
		const endpointUrl = ServerIO[key]
		if (!(key in ServerIO)) return; // Not defined, don't check it

		// Normally a URL that doesn't say "test" or "local" (empty string included) is production...
		let urlIsProd = !(endpointUrl.match(/(test|local|stage)/));
		// ...but APIBASE is special - it's normally empty for "this host" (except for My-Loop, which doesn't have its own backend)
		// So empty APIBASE (on non-production servers, with their own API) signifies NOT prod
		if (key === 'APIBASE' && !C.isProduction() && !ServerIO.NO_API_AT_THIS_HOST && !endpointUrl) {
			urlIsProd = false;
		}

		// Production site + production URL, or test site + test/local URL? Everything's fine.
		if (C.isProduction() === urlIsProd) return;

		if (!urlIsProd) {
			// Production site + test/local URL? Forcibly correct the URL.
			const err = new Error(`ServerIO.js - ServerIO.${key} is using a test setting! Oops: ${endpointUrl} - Resetting to '${prodValue}'`);
			ServerIO[key] = prodValue;
			console.warn(err);
		} else {
			// Test site + production URL? 

			// For safety reasons (to prevent accidentally editing live campaigns), you cannot use production APIBASE on the test server
			// (though server=production can still explicity override this, and local _can_ point to production as that can be handy when fixing stuff)
			const server = DataStore.getUrlValue("server");
			if ((C.SERVER_TYPE === "test" || C.SERVER_TYPE === "stage") && key === "APIBASE" && server !== "production") {
				const err = new Error(`ServerIO.js - ServerIO.${key} is using PRODUCTION setting! Oops: ${endpointUrl} - Resetting to ''`);
				ServerIO[key] = '';
				console.warn(err);
			} else {
				// Post a warning in the console. This is common enough for e.g. Datalog, or Profiler
				console.warn(`Using production ${name} Server: ${endpointUrl}`); 
			}
		}
	});
	// HACK -- allow testers to override
	checkBase2_toggleTestEndpoints();
}; //./checkBase()

/**
 * HACK allow using test/production ads, profiler, and datalog if requested.
 * To switch 
 * 
 * TODO refactor to use an endpoints loop like above
 */
const checkBase2_toggleTestEndpoints = () => {
	const server = DataStore.getUrlValue("server");
	if (!server) return;
	// Used by a few APIBASE instances
	const unprefixedHostname = window.location.hostname.replace(/^(local|test|stage)?/, '');
	if (server === 'test') {
		ServerIO.AS_ENDPOINT = 'https://testas.good-loop.com';
		ServerIO.PORTAL_ENDPOINT = 'https://testportal.good-loop.com';
		ServerIO.DATALOG_ENDPOINT = 'https://testlg.good-loop.com/data';
		ServerIO.PROFILER_ENDPOINT = 'https://testprofiler.good-loop.com';
		ServerIO.MEDIA_ENDPOINT = 'https://testuploads.good-loop.com';
		ServerIO.MEASURE_ENDPOINT = 'https://testmeasure.good-loop.com/measure';
		// ServerIO.ENDPOINT_NGO = 'https://test.sogive.org/charity';
		// hack for SoGive
		if (ServerIO.APIBASE.includes("sogive")) {
			ServerIO.APIBASE = 'https://test.sogive.org';
		} else {
			ServerIO.APIBASE = `https://test${unprefixedHostname}`;
		}
		// extra hack for my-loop:
		if (ServerIO.APIBASE && ServerIO.APIBASE.includes("local")) {
			ServerIO.APIBASE = ServerIO.APIBASE.replace("local", "test");
		}
		return;
	}
	if (server === 'local') { // probably not needed
		const protocol = window.location.protocol;
		ServerIO.AS_ENDPOINT = protocol+'//localas.good-loop.com';
		ServerIO.PORTAL_ENDPOINT = protocol+'//localportal.good-loop.com';
		ServerIO.DATALOG_ENDPOINT = protocol+'//locallg.good-loop.com/data';
		ServerIO.PROFILER_ENDPOINT = protocol+'//localprofiler.good-loop.com';
		ServerIO.MEDIA_ENDPOINT = protocol+'//localuploads.good-loop.com';
		ServerIO.MEASURE_ENDPOINT = protocol+'//localmeasure.good-loop.com/measure';
		ServerIO.APIBASE = ''; // lets assume you're on local
		return;
	}
	if (server === 'stage') {
		ServerIO.AS_ENDPOINT = 'https://stageas.good-loop.com';
		ServerIO.PORTAL_ENDPOINT = 'https://stageportal.good-loop.com';
		ServerIO.DATALOG_ENDPOINT = 'https://stagelg.good-loop.com/data';
		ServerIO.PROFILER_ENDPOINT = 'https://stageprofiler.good-loop.com';
		ServerIO.MEDIA_ENDPOINT = 'https://stageuploads.good-loop.com';
		ServerIO.MEASURE_ENDPOINT = 'https://stagemeasure.good-loop.com/measure';
		ServerIO.APIBASE = `https://stage${unprefixedHostname}`; // ?? fix in a refactor
		return;
	}
	if (server === 'production') {
		ServerIO.AS_ENDPOINT = 'https://as.good-loop.com';
		ServerIO.PORTAL_ENDPOINT = 'https://portal.good-loop.com';
		ServerIO.DATALOG_ENDPOINT = 'https://lg.good-loop.com/data';
		ServerIO.PROFILER_ENDPOINT = 'https://profiler.good-loop.com';
		ServerIO.MEDIA_ENDPOINT = 'https://uploads.good-loop.com';
		ServerIO.MEASURE_ENDPOINT = 'https://measure.good-loop.com/measure';
		if (ServerIO.APIBASE) {
			ServerIO.APIBASE = `https://${unprefixedHostname}`;
		} else if (ServerIO.APIBASE === '' || ServerIO.APIBASE === '/') {
			// extra hack for my-loop or moneyscript:
			ServerIO.APIBASE = `https://${(C.app.service|| C.app.name).toLowerCase()}.good-loop.com`;
		}
		// SoGive hack
		if (ServerIO.APIBASE && ServerIO.APIBASE.includes("sogive.org")) {
			ServerIO.APIBASE = "https://app.sogive.org";
		}
		return;
	}
	console.warn("ServerIOBase.js - Unrecognised server setting",server);
};


/**
 * Log servlet for ajax logging of client-side errors. Default "/log"
 *
 * This is NOT datalog! ??merge this with datalog?
 */
ServerIO.LOGENDPOINT = '/log';

/**
 * DataLog (lg.good-loop.com) index to use. e.g. "gl" for Good-Loop"
 */
ServerIO.LGDATASPACE = 'gl';



// Error Logging - but only the first error
window.onerror = _.once(function(messageOrEvent, source, lineno, colno, error) {
	// NB: source & line num are not much use in a minified file
	let msg = error? ""+error+"\n\n"+error.stack : ""+messageOrEvent;
	$.ajax({
		url: ServerIO.LOGENDPOINT,
		type: 'POST',
		data: {
			msg: window.location + ' ' + msg + ' user-id: ' + Login.getId(), // NB: browser type (user agent) will be sent as a header
			type: 'error'
		}
	});
});
// quiet asserts in production
if (C.isProduction()) {
	setAssertFailed(msg => {
		// we usually pass in an array from ...msg
		if (msg.length === 1) msg = msg[0];
		console.error("assert", msg);
		// A nice string?
		let smsg;
		try {
			smsg = JSON.stringify(msg);
		} catch(err) {
			smsg = ""+msg;
		}
		window.onerror(smsg, null, null, null, new Error("assert-failed: "));
	});
}


ServerIO.upload = function(file, progress, load, {params, endpoint = ServerIO.MEDIA_ENDPOINT}) {
	// Provide a pre-constructed XHR so we can insert progress/load callbacks
	const makeXHR = () => {
		const xhr = $.ajaxSettings.xhr(); //new window.XMLHttpRequest();
		// Event listeners on the upload object mean the XHR makes a preflight OPTIONS request,
		// and fail if ACAO and ACAC headers aren't set on the response. Not all our servers have this.
		if (ServerIO.UPLOAD_PROGRESS_SUPPORT) {
			xhr.upload.addEventListener('progress', progress);
		}
		xhr.addEventListener('load', load, false); // ??@Roscoe - Any particular reason for using onLoad instead of .then? ^Dan
		return xhr;
	};

	const data = new FormData(); // This is a browser native thing: https://developer.mozilla.org/en-US/docs/Web/API/FormData
	data.append('upload', file);
	params && Object.entries(params).forEach(([k, v]) => data.append(k, v));

	return ServerIO.load(endpoint, {
		xhr: makeXHR,
		data,
		type: 'POST',
		contentType: false,
		processData: false,
		swallow: true,
	});
};


/**
 * @deprecated Use ServerIO.list from Crud.js 
 */
ServerIO.search = function(type, filter) {
	assert(C.TYPES.has(type), type);
	let endpoint = ServerIO.getEndpointForType(type);
	let url = endpoint+'/_list.json';
	let params = {
		data: {}
	};
	if (filter) {
		params.data.filter = JSON.stringify(filter);
		if (filter.q) params.data.q = filter.q;
	}
	return ServerIO.load(url, params);
};


/**
 * @deprecated Use getDonationsData or getAllSpend for preference
 * 
 * @param {String} q
 * @param {String} dataspace
 * @param {{dataspace:String, q:?String}} filters deprecated
 * @param {?String[]} breakdowns - e.g. ['campaign'] will result in by_campaign results.
 * NB: the server parameter is currently `breakdown` (no -s).
 * Eventually we want to standardise on `breakdowns` as it's more intuitive for an array type,
 * but making the change server-side is expected to be very involved.
 * @param {?String|Date} start Date/time of oldest results (natural language eg '1 week ago' is OK). Default: 1 month ago
 * @param {?String|Date} end Date/time of oldest results
 * @param {?String} name Just for debugging - makes it easy to spot in the network tab
 * @returns {Promise} p response object
 */
ServerIO.getDataLogData = ({q, dataspace, filters={}, breakdowns = ['time'], start = '1 month ago', end = 'now', name}) => {
	console.warn("ServerIO.getDataLogData - old code - switch to DataLog.js getDataLogData")
	// HACK old calling convention
	if (filters.dataspace) {
		console.warn("ServerIOBase.js getDataLogData() Old calling pattern - please switch to q, dataspace as top-level", filters);
	}
	if (q) filters.q = q; if (dataspace) filters.dataspace = dataspace;
	if ( ! filters.dataspace) console.warn("No dataspace?!", filters);
	filters.breakdown = breakdowns; // NB: the server doesnt want an -s
	filters.start = start;
	filters.end = end;
	let endpoint = ServerIO.DATALOG_ENDPOINT;
	// This stats data is _usually_ non essential, so swallow errors.
	const params = {data: filters, swallow:true};
	const url = endpoint + (name ? `?name=${encURI(name)}` : '');
	return ServerIO.load(url, params);
};


/**
 * Contains some hacks: 
 * NGO (charity) -> SoGive (except for SoGive)
 * Support for /servlet/dataspace/id paths via ServerIO.dataspace (off by default)
 * 
 * Note: this can be over-ridden to special case some types
 * @param {?string} domain - e.g. "https://foo.com/" Leave unset (the norm) for "this server".
 */
ServerIO.getUrlForItem = ({type, id, domain = '', status}) => {
	// // HACK route charity requests to SoGive
	// if (type==='NGO' && C.app.id !== 'sogive') {
	// 	id = normaliseSogiveId(id);
	// 	const endpoint = ServerIO.ENDPOINT_NGO;
	// 	return endpoint+"/"+encURI(id)+'.json'+(status? '?status='+status : '');
	// }
	// TODO: check whether servlet is whole url because it would break the next line, but for now it's not expected if domain is used
	let servlet = ServerIO.getEndpointForType(type);
	let url = domain + servlet+'/' 
		+ (ServerIO.dataspace? ServerIO.dataspace+'/' : '')
		+ encURI(id)+'.json'
		+ (status? '?status='+status : '');
	return url;
};

/** HACK match mismatches.
 * WARNING: You rarely need to use this. ServerIO does this low-level for most cases.
 * 
 * @param {!string} id the charity ID as used e.g. in a Good-Loop advert
 * @returns {!string} the "proper" id for use with SoGive
 */
const normaliseSogiveId = id => {
	// Start with automatic adjustments
	const canonId = id.toLowerCase().replace('&', "and").replace(/[^a-zA-Z0-9]/g,'-');
	// manual id matching, only needed for ids that don't follow the rule: _ --> -
	let sid = {
		'alder-hey-': 'alder-hey',
		'art-fund': 'national-art-collections-fund',
		'bbct': 'bumblebee-conservation-trust',
		'bdfa': 'batten-disease-family-association',
		'care-international': 'care-international-uk',
		'centre-point':'centrepoint-soho',
		'centrepoint':'centrepoint-soho',
		'children-in-need': 'bbc-children-in-need',
		'diabetes-uk': 'the-british-diabetic-association',
		'great-ormand-street': 'great-ormand-street-hospital-childrens-charity',
		'learning-through-landscapes': 'the-learning-through-landscapes-trust',
		'learning-through-landscapes-teachertraining': 'the-learning-through-landscapes-trust',
		'medicins-sans-frontieres': 'medecins-sans-frontieres-aka-doctors-without-borders-or-msf',
		'movember-foundation': 'movember-europe',
		'ms-society': 'multiple-sclerosis-society',
		'npuk': 'niemann-pick-disease-group-uk',
		'nspcc': 'the-national-society-for-the-prevention-of-cruelty-to-children',
		'plan-uk': 'plan-international-uk',
		'refuge': 'refuge',
		'save-the-children': 'the-save-the-children-fund',
		'shelter-uk': 'shelter-national-campaign-for-homeless-people-limited',
		'st-johns-ambulance' : 'the-priory-of-england-and-the-islands-of-the-most-venerable-order-of-the-hospital-of-st-john-of-jerusalem',
		'tommys': 'tommy-s',
		'trussell-trust': 'the-trussell-trust',
		'war-child': 'war-child-uk',
		'water-aid': 'wateraid',
		'woodland':'woodland-trust',
		'wwf': 'wwf-uk',
		'tegenboog': 'de-regenboog-groep',
		'centrepoint': 'centrepoint-soho',
		'maw':'make-a-wish-uk',
		'gosh':'great-ormond-street-hospital-childrens-charity',
		'tommys':'tommy-s',
		'amnesty':'amnesty-international',
		'regenboog':'de-regenboog-groep',
		'weforest':'we-forest'
	}[canonId];

	return sid || canonId;
};

/**
 * type -> servlet url
 * This can call different micro-services, e.g. SoGive for charity data.
 * This is the crud url -- it is NOT the editor page.
 * @returns e.g. "/thingy" ot "https://app.sogive.org/charity"
 */
ServerIO.getEndpointForType = (type) => {
	// Future: refactor to be pluggable (but this is simpler and clearer for now)
	// // HACK route NGO=Charity, and go to sogive
	// if (type==='NGO') {
	// 	if (C.app.id === 'sogive') {
	// 		return '/charity';
	// 	} else {
	// 		return ServerIO.ENDPOINT_NGO;
	// 	}
	// }
	// HACK route Task to calstat
	if (type==='Task' && C.app.id !== 'calstat') {
		return ServerIO.ENDPOINT_TASK;
	}
	// HACK Change "advert" to "vert" to dodge some adblocking & route to Portal
	if (type==='Advert') {
		return (C.app.id === 'portal'? "" : ServerIO.PORTAL_ENDPOINT)+ '/vert';
	}
	// HACK Change "advertiser" to "vertiser" to dodge some adblocking & route to Portal
	if (type==='Advertiser') {
		return (C.app.id === 'portal'? "" : ServerIO.PORTAL_ENDPOINT)+ '/vertiser';
	}
	// HACK route Agency, Campaign, GreenTag, NGO to Portal
	if (['Agency','Campaign','GreenTag','ImpactDebit','ImpactCredit','NGO'].includes(type)) {
		if (C.app.id === 'sogive') {
			// HACK: not from portal /ngo for SoGive
			return '/charity';
		} 
		return (C.app.id === 'portal'? "" : ServerIO.PORTAL_ENDPOINT)+ '/' +type.toLowerCase();		
	}
	// HACK route Person to Profiler?
	if (type==="Person" && ServerIO.USE_PROFILER) {
		return ServerIO.PROFILER_ENDPOINT+"/person";
	}
	// normal = this domain's backend
	return '/'+type.toLowerCase();
};

/**
 * Submits an AJAX request. This is the key base method.
 * 
 * NB: Storing returned data items into DataStore is not done automatically
 * (to handle partial returns, security filtered returns, etc).
 * Methods like Crud's ActionMan.getDataItem *do* store into DataStore.
 *
 * @param {string} url The url to which the request should be made.
 * @param {object} [params] Optional map of settings to modify the request.
 * @param {boolean} [params.swallow] Don't display messages returned by the server
 * jQuery parameters (partial notes only)
 * @param {string} [params.credentials] If set to "omit", don't send jwt. Use-case: for when data is a string, so we can't add properties to it like Login.sign() tries to do.
 * @param {object} [params.data] data to send - this should be a simple key -> primitive-value map.
 * @param {object} [params.headers] Extra headers to set
 * @param {Function} [params.xhr] Used for special requests, e.g. file upload
 * @param {string} [params.method] e.g. POST
 * @see {@link https://api.jquery.com/jQuery.ajax/|jQuery AJAX} for more
 *
 * @returns A {@link https://api.jquery.com/jQuery.ajax/#jqXHR|jqXHR object}.
 * NB: a PromiseValue would be nicer, but the refactor would affect lots of code.
**/
ServerIO.load = function(url, params) {
	assMatch(url,String);
	// prepend the API base url? e.g. to route all traffic from a local dev build to the live backend.
	if (ServerIO.APIBASE && url.indexOf('http') === -1 && url.indexOf('//') !== 0) {
		url = ServerIO.APIBASE+url;
	}
	// console.log("ServerIO.load", url, params);
	params = ServerIO.addDefaultParams(params);
	// sanity check: no Objects except arrays
	Object.values(params.data).map(
		v => assert( ! _.isObject(v) || _.isArray(v), "Cannot add non-primitive parameter to "+url, v)
	);
	// sanity check: status
	assert( ! params.data.status || C.KStatus.has(params.data.status), params.data.status);
	params.url = url;
	// send cookies & add auth
	if (params.credentials !== "omit") { // NB: aping the fetch() API here, but there's no direct connection
		Login.sign(params); // could we make Login.sign() smarter around data.property vs cookies or headers??
	}
	// debug: add stack
	if (window.DEBUG) {
		try {
			const stack = new Error().stack;			
			// stacktrace, chop leading "Error at Object." bit
			params.data.stacktrace = (""+stack).replace(/\s+/g,' ').substr(16);
		} catch(error) {
			// oh well
		}
	}
	// Make the ajax call
	let defrd = $.ajax(params); // The AJAX request.
	// detect code-200-but-error responses
	defrd = defrd
		.then(response => {
			// check for success markers from JsonResponse or JSend
			if (response.success === false || response.status==='error' || response.status==='fail') {
				throw response;
			}
			// notify user of anything
			if ( ! params.swallow) {				
				ServerIO.handleMessages(response);
			}
			return response;
		})
		// on fail (inc a code-200-but-really-failed thrown above)
		.catch(response => {
			console.error('fail',url,params,response,new Error()); // add error so we can get a stacktrace to where the call came from
			// error message
			let text = response.status===404? 
				"404: Sadly that content could not be found."
				: "Could not load "+params.url+" from the server";
			if (response.responseText && response.status <= 500) {
				text = response.responseText;
			}
			if (response.statusText && response.status > 500) {
				// Nginx sets responseText to HTML pages for these, so instead just use statusText (eg 'Bad Gateway').
				text = response.statusText;
			}
			let msg = {
				id: 'error from '+params.url,
				type:'error', 
				text
			};
			// HACK hide details
			if (msg.text.indexOf('\n----') !== -1) {
				let i = msg.text.indexOf('\n----');
				msg.details = msg.text.substr(i);
				msg.text = msg.text.substr(0, i);
			}
			// bleurgh - a frameworky dependency
			if ( ! params.swallow) {
				notifyUser(msg);
			}
			// carry on error handling
			throw response;
		});
	return defrd;
}; // ./load()

/**
 * Just load() with method:POST
 */
ServerIO.post = function(url, data) {
	return ServerIO.load(url, {data, method: 'POST'});
};

ServerIO.put = function(url, data) {
	return ServerIO.load(url, {data, method: 'PUT'});
};

ServerIO.handleMessages = function(response) {
	const newMessages = response && response.messages;
	if ( ! newMessages || newMessages.length===0) {
		return response;
	}
	// Should we filter 409: Duplicate request ??
	newMessages.forEach(msg => notifyUser(msg));
	return response;
};

ServerIO.addDefaultParams = function(params) {
	if ( ! params) params = {};
	if ( ! params.data) params.data = {};
	return params;
};

export {
	// WARNING: You rarely need to use this
	normaliseSogiveId
}
