// NB: simplified and modularised copy of adunit's log.js

import ServerIO from './ServerIOBase';
import { assert, assMatch } from '../utils/assert';

/** datalog.js: the log-to-server calls
 * 
 * E.g.
 * `lg("myevent", {count:10})`
 * 
 * Events can only be logged once per window pane.
 * See also DataLog.js for using the data
 */

/* eslint-disable no-console */

const noDupes = {};
const nonce = Math.random();

// NB: chop down to the server (ie remove the /data servlet)
// NB: function to allow for race issues on ServerIO.DATALOG_ENDPOINT
const LBURL = () => (ServerIO.DATALOG_ENDPOINT || 'https://lg.good-loop.com').replace(/\/\w*$/,"");

const post = ServerIO.load;

// let prev = document.referrer;
/**
 * Better to put the img tag directly in the page's html if you can.
 * However: for dynamic pages -- like our react ones -- then it often has to be done dynamically to get the full referer url.
 */
const track = args => {
	const url = ""+window.location;
	const eventParams = {url};
	// if (prev && prev!==url) {
	// 	eventParams.prev = prev;
	// }
	const logPromise = lgBase("trk", "pxl", eventParams, true);
	// if (prev !==url) prev = url;
}


/**
 * This will not post an exact duplicate (but any change is enough to qualify for a fresh post)
 * @param dataspace {?String} If unset, use ServerIO.
 * @param eventTag {!String} e.g. minview. This will be lowercased. Parameters can be case sensitive, but event tags are not.
 * @return 
 */
const lgBase = (dataspace, eventTag, eventParams, addTrackingInfo) => {
	if ( ! dataspace) dataspace = ServerIO.LGDATASPACE;
	if ( ! dataspace) {
		console.error("DataLog", "Please set ServerIO.LGDATASPACE! For now, DataLog skips "+eventTag);
		return;
	}
	assMatch(dataspace, String, "log.js No dataspace:"+dataspace+" evt:"+eventTag);
	assMatch(eventTag, String, "log.js dataspace:"+dataspace+" No evt:"+eventTag);
	eventTag = eventTag.toLowerCase();
	if ( ! eventParams) eventParams = {};

	// Pull "count" and "gby" out of eventParams if present (promoting them to Real Params)
	let count, gby, site;
	count = eventParams.count;
	gby = eventParams.gby;
	site = eventParams.site;
	delete eventParams.count;
	delete eventParams.gby;
	delete eventParams.dataspace; // unusual, but in case eventParams was used to pass dataspace around

	if ( ! site) site = ""+window.location;

	// user info if logged in
	eventParams.user = Login.getId();

	const data = {
		d: dataspace,
		p: JSON.stringify(eventParams),
		r: document.referrer, // If in a SafeFrame, this will be the page url
		s: site, // If in a well-configured DfP ad, this will be the page url
		count, // Promote to root param; used to be member of p:
		gby, // Promote to root param; used to be member of p:
	};

	// dont do standard tracking?
	if (addTrackingInfo === false) {
		data.track = false;
	}

	// No exact duplicates
	try {
		const dupeKey = eventTag + JSON.stringify(data);
		if (noDupes[dupeKey]) {
			return null;
		}
		noDupes[dupeKey] = true;
	} catch(err) { // paranoia
		console.warn(err);
	}

	// log to console
	console.log("datalog", dataspace, eventTag, eventParams);

	// Pull eventTag out of request cargo and make a URL paramater so it's easily seen when debugging
	return post(`${LBURL()}/lg?t=${eventTag}`, {data});
};


/**
 * Note: will not post an exact duplicate (but any change is enough to qualify for a fresh post).
 * Also: The server will IGNORE an exact duplicate within a 15 minute time bucket. 
 * If this is not what you want - add `eventParams.nonce = nonce()` which makes the event a unique one-off.
 * @param glslot Can be null for window-level events (e.g. the adblock test). Otherwise this really should be set!
 * @param eventTag {!String}
 * @param eventParams {?Object}
 * @returns {?Promise}
 */
const lg = (eventTag, eventParams) => {
	// safety check inputs
	// TODO A more descriptive slot-ID than "preact"?
	if (typeof(eventTag) !== 'string') {
		lgError(`Bad lg() inputs! eventTag: ${eventTag} glslot: ${'preact'}`);
	}

	let dataspace = eventParams.dataspace; // usually unset, so this will use the default
	const logPromise = lgBase(dataspace, eventTag, eventParams, true);
	if ( ! logPromise) {
		return null; // Tried to log a dupe
	}

	// Return the promise so we can e.g. do some final logging when cleaning up, THEN uninstall, without race conditions.
	return logPromise;
};


/* Error-specific logging methods */

/** General error/warning */
const lgProblem2 = (level, message, params) => {
	const lgParams = {
		message,
		...params,
	};
	return lg(level, lgParams);
};

/**
 * @param message A short description of the event causing the error/warning
 * @param params {} Extra information on the circumstances of the event
 */
const lgError = (message, params) => lgProblem2('error', message, params);
const lgWarning = (message, params) => lgProblem2('warning', message, params);

export { lg, lgError, lgWarning, track };
