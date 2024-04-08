import _ from 'lodash';
import Enum from 'easy-enums';
import { assert, assMatch } from './assert';
import printer from './printer';
import PromiseValue from '../promise-value';


// Switched back to js from ts March 2023 since the old ts file gave many errors. 
// TODO properly write a ts port

export const isDebug = () => {
	return window.isDebug; // set by our index.html code (which also picks which js bundle to load)
};

export const randomPick = function (array) {
	if (!array) {
		return null;
	}
	if (!array.length) {
		return null;
	}
	let r = Math.floor(array.length * Math.random());
	assert(r < array.length, array);
	return array[r];
};

export const sum = (array) => array.reduce((acc, a) => acc + a, 0);

/**
 * Is this a number or number-like?
 * @param {?String|Number} value
 * @returns {Boolean}
 */
// ref: https://stackoverflow.com/questions/18082/validate-decimal-numbers-in-javascript-isnumeric
export const isNumeric = (value) => {
	return !isNaN(value - parseFloat(value));
};

/**
 * @returns true for mobile or tablet
 */
export const isMobile = () => {
	// NB: COPIED FROM ADUNIT'S device.js
	const userAgent = navigator.userAgent || navigator.vendor || window.opera;
	let _isMobile = userAgent.match('/mobile|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i');
	return !!_isMobile;
};
/**
 * Bootstrap 2/3-letter screen sizes e.g. "md"
 */
export const KScreenSize = new Enum('xs sm md lg xl xxl');
/**
 * Bootstrap 2/3-letter screen sizes e.g. "md"
 * See https://getbootstrap.com/docs/4.5/layout/overview/#containers
 * @returns {KSreenSize} xs sm md lg xl xxl
 */
export const getScreenSize = () => {
	const w = window.innerWidth; // outerWidth includes e.g. the dev console
	if (w < 576) return KScreenSize.xs;
	if (w < 768) return KScreenSize.sm;
	if (w < 992) return KScreenSize.md;
	if (w < 1200) return KScreenSize.lg;
	if (w < 1400) return KScreenSize.xl;
	return KScreenSize.xxl;
};

/**  */
export const isPortraitMobile = () => window.matchMedia('only screen and (max-width: 768px)').matches && window.matchMedia('(orientation: portrait)').matches;

export const KBrowser = new Enum('CHROME EDGE FIREFOX SAFARI OTHER');
/**
 * @returns {!String} CHROME EDGE FIREFOX SAFARI OTHER
 * See https://stackoverflow.com/questions/4565112/javascript-how-to-find-out-if-the-user-browser-is-chrome
 * https://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
 */
export const getBrowserVendor = () => {
	// for debugging
	if (getUrlVars().browserVendor) {
		return getUrlVars().browserVendor;
	}
	const isChromium = window.chrome;
	const winNav = window.navigator;
	const vendorName = winNav.vendor;
	const isOpera = typeof window.opr !== 'undefined';
	const isIEedge = winNav.userAgent.indexOf('Edg') > -1;
	const isIOSChrome = winNav.userAgent.match('CriOS');

	if (isIOSChrome) {
		// is Google Chrome on IOS
		return 'CHROME';
	}
	if (isChromium !== null && typeof isChromium !== 'undefined' && vendorName === 'Google Inc.' && isOpera === false && isIEedge === false) {
		// is Google Chrome
		return 'CHROME';
	}

	// Internet Explorer 6-11
	var isIE = /*@cc_on!@*/ false || !!document.documentMode;
	// Edge (based on chromium) detection
	if (window.chrome && navigator.userAgent.indexOf('Edg') != -1) return 'EDGE';
	if (!isIE && window.StyleMedia) return 'EDGE'; // older edge??

	// Safari 3.0+ "[object HTMLElementConstructor]"
	if (navigator.userAgent.indexOf('Safari') != -1) {
		return 'SAFARI';
	}

	// Firefox 1.0+
	if (typeof InstallTrigger !== 'undefined') {
		return 'FIREFOX';
	}

	// Opera 8.0+
	if ((window.opr && opr.addons) || window.opera || navigator.userAgent.indexOf(' OPR/') >= 0) {
		return 'OPERA';
	}
	return 'OTHER';
}; // ./ getBrowserVendor

/**
 * @returns true if share was invoked, false if copy-to-clipboard was invoked
 */
export const doShare = ({ href, title, text }) => {
	if (!navigator.share) {
		console.warn('No share function');
		copyTextToClipboard(href);
		return false;
	}
	navigator.share({ url: href, title, text });
	return true;
};

function fallbackCopyTextToClipboard(text) {
	var textArea = document.createElement('textarea');
	textArea.value = text;

	// Avoid scrolling to bottom
	textArea.style.top = '0';
	textArea.style.left = '0';
	textArea.style.position = 'fixed';

	document.body.appendChild(textArea);
	textArea.focus();
	textArea.select();

	try {
		var successful = document.execCommand('copy');
		var msg = successful ? 'successful' : 'unsuccessful';
		console.log('Fallback: Copying text command was ' + msg);
	} catch (err) {
		console.error('Fallback: Oops, unable to copy', err);
	}

	document.body.removeChild(textArea);
}

export function copyTextToClipboard(text) {
	if (!navigator.clipboard) {
		fallbackCopyTextToClipboard(text);
		return;
	}
	navigator.clipboard.writeText(text).then(
		function () {
			console.log('Async: Copying to clipboard was successful!');
		},
		function (err) {
			console.error('Async: Could not copy text: ', err);
		}
	);
}

/**
 * Convenience for spacing base-css-class + optional-extra-css-class.
 * Skips falsy, so you can do e.g. `space(test && "value")`.
 * Recursive, so you can pass an arg list or an array OR multiple arrays.
 * @returns {!string} "" if no inputs
 */
export const space = (...strings) => {
	let js = '';
	if (!strings) return js;
	strings.forEach((s) => {
		if (!s) return;
		if (s.forEach && typeof s !== 'string') {
			// recurse
			s = space(...s);
			if (!s) return;
		}
		js += ' ' + s;
	});
	return js.trim();
};


/**
 * Give an arbitrary list of presumed nouns natural-language spacing, commas, and conjunctions.
 * @param {string[]} list Array of words (although other types will be coerced to strings)
 * @param {boolean} oxford True or omitted for "a, b, and c"; false for "a, b and c"
 * @returns {string}
 */
export const commaList = (list, oxford = true) => {
	const lastCommaAt = (list.length <= 2) ? (-1) : (list.length - (oxford ? 2 : 3));
	const andAt = (list.length < 2) ? (-1) : (list.length - 2);
	return list.map((item = '', i) => {
		const toPrint = (item + '').trim(); // coerce to string and strip extra spaces
		if (!toPrint.length) return '';
		return `${toPrint}${i <= lastCommaAt ? ',' : ''}${i === andAt ? ' and' : ''}${i < list.length - 1 ? ' ' : ''}`;
	}).join('');
};


/**
 * @param unescapedHash e.g. "foo=bar"
 * This must be the whole post-hash state.
 */
const setHash = function (unescapedHash) {
	assert(unescapedHash[0] !== '#', 'No leading # please on ' + unescapedHash);
	if (history && history.pushState) {
		let oldURL = '' + window.location;
		history.pushState(null, null, '#' + encURI(unescapedHash));
		fireHashChangeEvent({ oldURL });
	} else {
		// fallback for old browsers
		location.hash = '#' + encURI(unescapedHash);
	}
};
/**
 * Note: params will be string valued EXCEPT "true" and "false", which are coerced to booleans.
 * No path will return as []
 * @returns path:string[], params:Object
 */
export const parseHash = function (hash = window.location.hash) {
	let params = getUrlVars(hash);
	// Pop the # and peel off eg publisher/myblog NB: this works whether or not "?"" is present
	let page = hash.substring(1).split('?')[0];
	const path = page.length ? page.split('/').map(decURI) : [];
	return { path, params };
};


/**
 * @deprecated Use modifyPage() instead, which can handle /page or #page
 * NB: this function provides the #page code for modifyPage()
 *
 * @param {?String[]} newpath Can be null for no-change
 * @param {?Object} newparams Can be null for no-change
 * @param {?Boolean} returnOnly If true, do not modify the hash -- just return what the new value would be (starting with #)
 */
export const modifyHash = function (newpath, newparams, returnOnly) {
	const { path, params } = parseHash();
	let allparams = params || {};
	allparams = Object.assign(allparams, newparams);
	if (!newpath) newpath = path || [];
	let hash = encURI(newpath.join('/'));
	if (yessy(allparams)) {
		let kvs = mapkv(allparams, (k, v) => encURI(k) + '=' + (noVal(v) ? '' : encURI(v)));
		hash += '?' + kvs.join('&');
	}
	if (returnOnly) {
		return '#' + hash;
	}
	if (history && history.pushState) {
		let oldURL = '' + window.location;
		history.pushState(null, null, '#' + hash);
		// generate the hashchange event
		fireHashChangeEvent({ oldURL });
	} else {
		// fallback for old browsers
		location.hash = '#' + hash;
	}
};


let fireHashChangeEvent = function ({ oldURL }) {
	// NB IE9+ on mobile
	// https://developer.mozilla.org/en-US/docs/Web/API/HashChangeEvent
	let e = new HashChangeEvent('hashchange', {
		newURL: '' + window.location,
		oldURL: oldURL,
	});
	window.dispatchEvent(e);
};


export const scrollTo = (id) => {
	let $el = document.getElementById(id);
	$el.scrollIntoView({ behavior: 'smooth' });
};


/**
 * Map fn across the (key, value) properties of obj.
 *
 * Or you could just use Object.entries directly -- but IE doesn't support it yet (Jan 2019)
 *
 * @returns {Object[]} array of fn(key, value)
 */
export const mapkv = function (obj, fn) {
	return Object.keys(obj).map((k) => fn(k, obj[k]));
};

/**
 * Strip commas £/$/euro and parse float.
 * @param {Number|String} v
 * @returns {?Number}. undefined/null/''/false/NaN are returned as undefined.
 * Bad inputs also return undefined (this makes for slightly simpler usage code
 *  -- you can't test `if (x)` cos 0 is falsy, but you can test `if (x!==undefined)`)
 */
export const asNum = (v) => {
	if (noVal(v) || v === '' || v === false || v === true || Number.isNaN(v)) {
		return undefined;
	}
	if (_.isNumber(v)) return v;
	// strip any commas, e.g. 1,000
	if (_.isString(v)) {
		v = v.replace(/,/g, '');
		// £ / $ / euro
		v = v.replace(/^(-)?[£$\u20AC]/, '$1');
	}
	// See https://stackoverflow.com/questions/12227594/which-is-better-numberx-or-parsefloatx
	const nv = +v;
	if (Number.isNaN(nv)) {
		return null; // bad string input
	}
	return nv;
};

/**
 * Is it an array? undefined? a single value? Whatever -- give me an array.
 * @param {?any} hm If null/undefined/"", return []. If an array-like map, copy it into an array
 * @returns {Object[]}
 */
export const asArray = (hm) => {
	if (!is(hm) || hm === '') return [];
	if (_.isArray(hm)) return hm;
	// HACK: catch {0:foo, 1:bar}
	let keys = Object.keys(hm);
	if (keys.length && !keys.find((key) => !isNumeric(key))) {
		let arr = [];
		keys.forEach((k) => (arr[k] = hm[k]));
	}
	return [hm];
};

/**
 * @param {!string} src url for the script
 * @param {?Function} onload called on-load and on-error
 * @param {?dom-element} domElement append to this, or to document.head
 * NB: copy-pasta of Good-Loop's unit.js addScript()
 */
export const addScript = function ({ src, async, onload, onerror, domElement }) {
	let script = document.createElement('script');
	script.setAttribute('src', src);
	if (onerror) script.addEventListener('error', onerror);
	if (onload) script.addEventListener('load', onload);
	script.async = async;
	script.type = 'text/javascript';
	// c.f. https://stackoverflow.com/questions/538745/how-to-tell-if-a-script-tag-failed-to-load
	// c.f. https://stackoverflow.com/questions/6348494/addeventlistener-vs-onclick
	if (!domElement) {
		let head = document.getElementsByTagName('head')[0];
		domElement = head || document.body;
	}
	domElement.appendChild(script);
};

/**
 * A more flexible (and dangerous) version of substring.
 *
 * @param {string} mystring
 *            Can be null, in which case null will be returned
 * @param {!number} start
 *            Inclusive. Can be negative for distance from the end.
 * @param {?number} end
 *            Exclusive. Can be null for "up to the end". Can be negative for distance from the end. E.g. -1
 *            indicates "all but the last character" (zero indicates
 *            "up to the end"). Can be longer than the actual string, in
 *            which case it is reduced. If end is negative and too large, an
 *            empty string will be returned.
 * @returns {?string} The chopped string. null if the input was null. The empty string
 *         if the range was invalid.
 */
export const substr = (mystring, _start, _end) => {
	if (!mystring) return mystring;
	// keep the original values around for debugging
	let start = _start;
	let end = _end || 0;
	const len = mystring.length;
	// start from end?
	if (start < 0) {
		start = len + start;
		if (start < 0) {
			start = 0;
		}
	}
	// from end?
	if (end <= 0) {
		end = len + end;
		if (end < start) {
			return '';
		}
	}
	assert(end >= 0, start + ' ' + end);
	// too long?
	if (end > len) {
		end = len;
	}
	// OK
	if (start == 0 && end == len) return mystring;
	if (end < start) {
		console.warn('substr() - Bogus start(' + _start + ')/end(' + _end + ' for ' + mystring);
		return '';
	}
	assert(start >= 0 && end >= 0, start + ' ' + end);
	return mystring.substring(start, end);
};

/**
 *
 * @param {?String} url Defaults to window.location.hostname
 * @returns {!String} e.g. "bbc.co.uk", "google.com", etc.
 */
export const getDomain = (url) => {
	if (!url) url = window.location.hostname;
	let m = url.match(/^(?:.*?\.)?([a-zA-Z0-9\-_]{3,}\.(?:\w{2,8}|\w{2,4}\.\w{2,4}))$/);
	if (!m) {
		// safety / paranoia
		console.error('getDomain() error for ' + url);
		return url;
	}
	return m[1];
};

/** Parse url arguments
 * @param {?string} url Optional, the string to be parsed, will default to window.location when not provided.
 * @param {?Boolean} lenient If true, if a decoding error is hit, it is swallowed and the raw string is used.
 * Use-case: for parsing urls that may contain adtech macros.
 * @returns {any} */
// NB: new UrlSearchParams(searchFragment) can now do much of this
export const getUrlVars = (url, lenient) => {
	// Future thought: Could this be replaced with location.search??
	// Note: location.search doesn't look past a #hash
	url = url || window.location.href;

	// url = url.replace(/#.*/, ''); Why was this here?! DW
	// Bug seen 2023-08: we want to get params before and after the hash, but not read the # as part of the preceding param
	// ie not https://my.good-loop.com/impact/view/brand/VAcnHLcz?gl.status=DRAFT# --> { 'gl.status': 'DRAFT#' }
	const hashIndex = url.indexOf('#');
	if (hashIndex >= 0) {
		const before = url.substring(0, hashIndex);
		const after = url.substring(hashIndex + 1);
		const splitVars = getUrlVars(before);
		// Don't remove this conditional, it stops infinite recursion when the hash is trailing
		if (after) Object.assign(splitVars, getUrlVars(after));
		return splitVars;
	}

	var s = url.indexOf('?');
	if (s == -1 || s == url.length - 1) return {};

	var varstr = url.substring(s + 1);
	var kvs = varstr.split('&');
	var urlVars = {};

	for (var i = 0; i < kvs.length; i++) {
		var kv = kvs[i];
		if (!kv) continue; // ignore trailing &
		var e = kv.indexOf('=');
		if (e == -1) {
			continue;
		}
		let k = kv.substring(0, e);
		k = k.replace(/\+/g, ' ');
		k = decURI(k);
		let v = null; //'';
		if (e === kv.length - 1) continue;
		v = kv.substring(e + 1);
		v = v.replace(/\+/g, ' ');
		try {
			v = decURI(v);
		} catch (err) {
			if (!lenient) throw err;
			console.warn('const js getUrlVars() decode error for ' + kv + ' ' + err);
		}
		// hack for boolean
		if (v === 'true') v = true;
		if (v === 'false') v = false;
		urlVars[k] = v;
	}

	return urlVars;
};


export const setUrlParameter = (url, key, value) => {
	assMatch(url, String, 'setUrlParameter null url key:' + key);
	if (!is(value)) {
		return url;
	}
	let newUrl = url.includes('?') ? url + '&' : url + '?';
	newUrl += encURI(key) + '=' + encURI(value);
	return newUrl;
};

const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
/**
	Validate email addresses using what http://emailregex.com/ assures me is the
	standard regex prescribed by the W3C for <input type="email"> validation.
	https://www.w3.org/TR/html-markup/input.email.html#input.email.attrs.value.single
	NB this is more lax
	@param string A string which may or may not be an email address
	@returns True if the input is a string & a (probably) legitimate email address.
*/
export const isEmail = function (s) {
	return !!('string' === typeof s && s.match(emailRegex));
};

/**
 * Matches urls. Note: Excludes any trailing .	<br>
 * Group 1: the host/domain (including subdomain) - can be "" for a file url	<br>
 * Urls must contain the http(s) protocol (compare with Twitter's regex which doesn't require a protocol).
 *
 * E.g. "https://twitter.com/foo"
 * */
export const urlRegex = /https?:\/\/([a-zA-Z0-9_\-\.]*)\/?([a-zA-Z0-9_%\-\.,\?&\/=\+'~#!\*:]+[a-zA-Z0-9_%\-&\/=\+])?/g;
window.urlRegex = urlRegex;

/**
Like truthy, but "false", {}, [], [null], and [''] are also false alongside '', 0 and false.
*/
export const yessy = function (val) {
	// any falsy value returns false
	if (!val) return false;
	if (typeof val === 'number' || typeof val === 'boolean') {
		return true;
	}
	if (typeof val === 'object' && val.length === undefined) {
		assert(typeof val !== 'function', 'yessy(function) indicates a mistake: ' + val);
		val = Object.getOwnPropertyNames(val);
	}
	if (val.length === 0) {
		return false;
	}
	if (val === 'false') {
		return false;
	}
	// array|string?
	if (val.length) {
		for (let i = 0; i < val.length; i++) {
			if (val[i]) return true;
		}
		// array of falsy
		return false;
	}
	return true;
};


/**
 * Actually `x == null` would do the same, but this is clearer 'cos it doesn't rely on language details.
 * TODO Standardise on this vs noVal?
 * @returns {boolean}
 */
export const noVal = x => (x === null || x === undefined);


/**
 * Convenience for not-null not-undefined (but can be false, 0, or "")
 * TODO Standardise on this vs noVal?
 * @returns {boolean}
 */
export const is = x => (x !== undefined && x !== null);


const getStackTrace = function () {
	try {
		const stack = new Error().stack;
		// stacktrace, chop leading "Error at Object." bit
		let stacktrace = ('' + stack).replace(/\s+/g, ' ').substr(16);
		return stacktrace;
	} catch (error) {
		// oh well
		return '';
	}
};

/**
 * @return {string} a unique ID
 * For a smaller nonce, use DataClass.js nonce
 */
export const uid = function () {
	// A Type 4 RFC 4122 UUID, via http://stackoverflow.com/a/873856/346629
	var s = [];
	var hexDigits = '0123456789abcdef';
	for (var i = 0; i < 36; i++) {
		s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
	}
	s[14] = '4'; // bits 12-15 of the time_hi_and_version field to 0010
	s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1); // bits 6-7 of the clock_seq_hi_and_reserved to 01
	s[8] = s[13] = s[18] = s[23] = '-';
	var uuid = s.join('');
	return uuid;
};

/**
 * Test for deep equals
 * @param a
 * @param b
 */
export const equals = (a, b) => {
	return JSON.stringify(a) === JSON.stringify(b);
};
// window.equals = equals; // debug

//** String related functions */

/** Uppercase the first letter, lowercase the rest -- e.g. "dan" to "Daniel" */
export const toTitleCase = function (s) {
	if (!s) return s;
	return s[0].toUpperCase() + s.substr(1).toLowerCase();
};

/**
 * Truncate text length.
 */
export const ellipsize = function (s, maxLength) {
	if (!s) return s;
	if (!maxLength) maxLength = 140;
	if (s.length <= maxLength) return s;
	return s.substr(0, maxLength - 1).replace(/ *$/g, '') + '…'; // NB: React doesn't render html entities, so lets use a unicode ellipsis.
};

/**
 * e.g. winterwell.com from http://www.winterwell.com/stuff
 */
export const getHost = function (url) {
	var a = document.createElement('a');
	a.href = url;
	var host = a.hostname;
	if (host.startsWith('www.')) host = host.substr(4);
	return host;
};

export const getLogo = (item) => {
	if (!item) return null;
	// HACK ads store logo under item.branding.logo
	// Kept old syntax in as back-up / more generic
	let img = (item.branding && item.branding.logo) || item.logo || item.img || item.photo || (item.std && item.std.img);
	if (!img) return null;
	// If its an ImageObject then unwrap it
	if (img.url) img = img.url;
	return img;
};

/**
 * Make an option -> nice label function
 * @param options
 * @param {?String[]|Object|Function} labels Can be falsy
 * @returns {Function} option to label
 */
export const labeller = function (options, labels) {
	if (!labels) return fIdentity;
	if (_.isArray(labels)) {
		return (v) => labels[options.indexOf(v)] || v;
	} else if (_.isFunction(labels)) {
		return labels;
	}
	// map
	return (v) => labels[v] || v;
};
const fIdentity = (x) => x;

/**
 * Encoding should ALWAYS be used when making html from json data.
 *
 * There is also CSS.escape() in the file css.escape.js for css selectors,
 * which we get from https://developer.mozilla.org/en-US/docs/Web/API/CSS.escape
 * and may become a standard.
 *
 */

/** Url-encoding: e.g. encode a parameter value so you can append it onto a url.
 * 
 * Why? When there are 2 built in functions:
 * 
 * 1. escape() robust but doesn't handle unicode.
 * 2. encodeURIComponent() has better unicode handling -- however it doesn't escape 's which makes it dangerous,
 * and it does (often unhelpfully) encode /s and other legitimate url characters.
 * This is a super-solid best-of-both.
*/
export const encURI = function (urlPart) {
	urlPart = encodeURIComponent(urlPart);
	urlPart = urlPart.replace(/'/g, '%27');
	// Keep some chars which are url safe
	urlPart = urlPart.replace(/%2F/g, '/');
	return urlPart;
};

/**
 * Just `decodeURIComponent`
 * @param {string} urlPart 
 * @returns {string}
 */
export const decURI = function (urlPart) {
	let decoded = decodeURIComponent(urlPart);
	return decoded;
};

/**
 * preventDefault + stopPropagation
 * @param e {?Event|Object} a non-event is a no-op
 * @returns true (so it can be chained with &&)
 */
export const stopEvent = (e) => {
	if (!e) return true;
	if (e.preventDefault) {
		try {
			e.preventDefault();
			e.stopPropagation();
			// e.returnValue = false; Is this needed for some events on some browsers? e.g. https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload
		} catch (err) {
			console.warn('(swallow) stopEvent cant stop', e, err);
		}
	}
	return true;
};

/**
 *
 * @param x Convert anything to a string in a sensible-ish way.
 *
 * Minor TODO: refactor printer.js to use `export` and use that directly
 */
export const str = (x) => printer.str(x);


/**
 * Create a debounced function - which returns a PromiseValue.
 * This differs from plain debounce which returns null (as the function hasn't been called yet);
 * Use-case: debounce with promise-style .then() follow-on code
 * @param fn Do the thing!
 * @param msecs Milliseconds to wait in debounce
 * @returns {PromiseValue} Each call returns a fresh PV with a fresh debounced fn! You must cache this to get the debounce effect.
 */
export const debouncePV = (fn, msecs) => {
	let pv = PromiseValue.pending();
	const rpv = { ref: pv };
	// debounce and resolve the PV
	let dfn = _.debounce((...args) => {
		try {
			let p = fn(...args);
			if (!p || !p.then) {
				rpv.ref.resolve(p);
				return;
			}
			p.then(
				(res) => {
					rpv.ref.resolve(res);
					// fresh pv for future calls
					rpv.ref = PromiseValue.pending();
				},
				(err) => {
					rpv.ref.reject(err);
					// fresh pv for future calls
					rpv.ref = PromiseValue.pending();
				}
			);
		} catch (err) {
			rpv.ref.reject(err);
		}
	}, msecs);
	// return the PV
	let dfnpv = (...args) => {
		dfn(...args);
		return rpv.ref;
	};
	return dfnpv;
};

/**
 * Call a function, but not too often.
 * Add persistence to debounce, allowing use with arguments.
 * See https://lodash.com/docs/4.17.15#debounce
 * @param {!Function} fn
 * @param {!Object[]} fixedParams These + fn define the persistent function.
 * The same base fn + the same fixedParams = the same debounced function.
 * The same base fn with different fixedParams is treated as an independent function.
 * @param {!Object[]} flexParams If these change, then cancel and repeat the function with the new values
 * @param {?Number} wait milliseconds
 * @param {?Object} options
 */
export const debounced = (fn, fixedParams, flexParams, wait, options) => {
	const key = (fn.name || fn + '') + fixedParams.map(str).join('|');
	const flexkey = flexParams.map(str).join('|');
	let dfn_flex = debounced_flexkey4key[key];
	// parameter change?
	if (dfn_flex && dfn_flex[1] !== flexkey) {
		console.log('debounced - cancel the old', key);
		dfn_flex[0].cancel(); // cancel the old
		dfn_flex = null; // make a new...
	}
	// make new debounce
	if (!dfn_flex) {
		const params = fixedParams.concat(flexParams);
		const curried = () => fn(...params);
		const dfn = _.debounce(curried, wait, options);
		debounced_flexkey4key[key] = [dfn, flexkey]; // persist with flexkey to detect parameter changes
		console.log('debounced - call it 1st', key);
		return dfn(); // call it
	}
	// call it again
	console.log('debounced - call it again', key);
	return dfn_flex[0]();
};

/** persistent debounced functions for debounced()
 * TODO clean these out periodically - can we check for which ones are done? No, but we can flush() them.
 */
const debounced_flexkey4key = {};


/**
 * Convenience to de-dupe and remove falsy from an array
 * @param {Object[]} array
 * @returns {Object[]} copy of array
 */
export const uniq = (array) => {
	const set = new Set(array.filter((x) => x));
	return Array.from(set); // NB: There's an odd error with [...set] in chrome, http://localmy.good-loop.com/#campaign?agency=late_aug_2021_agency, Sept 2021
};


/**
 * Convenience to de-dupe and remove falsy from an array
 * @param {Object[]} array
 * @param {?Function} keyFn Defaults to .id
 * @returns {Object[]} copy of array, de-duped by id. Falsy items and falsy ids are filtered out
 */
export const uniqById = (array, keyFn) => {
	if (!keyFn) keyFn = (item) => item && item.id;
	let item4id = {};
	array.forEach((item) => {
		let key = keyFn(item);
		if (!key) return;
		item4id[key] = item;
	});
	return Object.values(item4id);
};


/**
 * Convert a keyset {name:bool} type object to an array
 * @param {Object} keysetObj
 */
export const keysetObjToArray = (keysetObj) => {
	return Object.keys(keysetObj).filter((item) => keysetObj[item]);
};


/**
 * Convert an array of objects with ids to a list of ids
 * @param {?Array} idObjArray
 */
export const idList = (idObjArray) => {
	return idObjArray ? idObjArray.map((obj) => obj.id) : [];
};


/**
 * Gives the appropriate indefinite article for an English noun.
 * Wrote this because I was sick of seeing the advert list tell me "To create a Advert, first pick a Advertiser". -Roscoe
 * @param {Object} noun An object which will be coerced to a string and checked for an initial vowel
 * @returns {String} "a" or "an", as appropriate for the supplied noun.
 */
export const article = (noun) => ('aeiou'.indexOf(String(noun).toLowerCase()[0]) >= 0 ? 'an' : 'a');


/**
 *
 * @param {?String} text
 * @returns {!String} lowercase, trim, strip punctuation and other non-letters, and compact whitespace.
 */
export const toCanonical = (text) => {
	if (!text) return '';
	return text.trim().toLowerCase().replaceAll(/\W+/g, ' ');
};


export const hardNormalize = (text) => {
	text = toCanonical(text);
	// Remove all non-letter characters entirely
	text = text.replaceAll(/\W+/g, '').replaceAll(/ +/g, '');
	return text;
};


/**
 * Find a partial match of string "match" in string "text"
 * 1 = full match, 0 = no match
 * @param {String} text
 * @param {String} match
 * @param {?Boolean} splitWords do individual searches per word, split by spacing, punctuation and cases
 * @param {?Boolean} normalize normalize strings before attempting matches. if splitWords is used, will occur after word splits
 * @returns
 */
export const partialMatch = (text, match, splitWords, normalize) => {
	// Function to find a factor of one string against another
	const searchFunc = (t, m) => {
		const len = m.length;
		// Reduce match length until a match is made
		for (let i = len; i > 0; i--) {
			if (t.includes(m.substring(0, i))) {
				// Find factor of match and return
				// 1 = perfect match, 0 = no match
				const factor = i / len;
				return factor;
			}
		}
		return 0;
	};

	// Function to split words up by spacing, punctuation and casing
	const splitWordsFunc = (t) => {
		let res = t
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/\W/g, ' ')
			.split(' ')
			.filter((x) => x && x !== '');
		return res;
	};

	if (!splitWords) {
		if (normalize) {
			text = hardNormalize(text);
			match = hardNormalize(match);
		}
		return searchFunc(text, match);
	} else {
		// Splitting words does not take up the full search, as the full search can still have a strong yield
		// So the split word result contibutes 50% and the full search contributes 50% to the returned factor
		const textWords = splitWordsFunc(text);
		const matchWords = splitWordsFunc(match);
		let totalMatch = 0;
		matchWords.forEach((m) => {
			textWords.forEach((t) => {
				let m2 = m;
				let t2 = t;
				if (normalize) {
					m2 = hardNormalize(m);
					t2 = hardNormalize(t);
				}
				totalMatch += searchFunc(t2, m2);
			});
		});
		const totalLen = matchWords.length * textWords.length;
		if (totalLen === 0) return 0;
		const splitFactor = totalMatch / totalLen;

		if (normalize) {
			text = hardNormalize(text);
			match = hardNormalize(match);
		}
		const fullFactor = searchFunc(text, match);

		return (splitFactor + fullFactor) / 2;
	}
};


/**
 * same as Array.map, but just takes a number. Useful for render functions
 * @param func function to loop with
 */
export const mapNew = (num, func) => {
	const numIterator = Array.from(Array(num));
	return numIterator.map((v, i) => func(i));
};


/**
 * Convert a MouseEvent.buttons number to an array of booleans
 * - See https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
 * - TLDR: it's a number which, in binary, is a bitfield where LSB = left click, 2s = right, 4s =  middle etc)
 * - So e.g. 6 --> '110' --> ['1', '1', '0'] --> ['0', '1', '1'] --> [false, true, true] --> left no, right yes, middle yes
 * @param {Number} buttons
 * @return {Array[boolean]} Buttons reported as "down" by this MouseEvent, in order L, R, Middle, [Back], [Forward]
 */
export const decodeButtons = (buttons = 0) => {
	return buttons
		.toString(2)
		.padStart(5, '0')
		.split('')
		.reverse()
		.map((digit) => !!Number.parseInt(digit));
};


/**
 * Add separating commas to a number
 * @param x number
 * @returns {String}
 */
 export const addNumberCommas = (x) => {
	return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};


const suffixes = ['', 'K', 'M', 'B'];

/**
 * ?? Do normal people grok e.g. "10M" "5B"?? Would we better saying "10 million" "5 billion"?
 * 
 * Convert a number into being expressed as units of billions, millions or thousands
 * 1000 -> 1k, 10,000 -> 10k, 1,000,000 -> 1M
 * note this doesn't round, so if the goal is to make your number look pretty you'll need to pass this a rounded num
 * @param {Number} num 
 * @returns {String} num expressed in units of billions, millions or 
 */
export const addAmountSuffixToNumber = (num) => {
	const exponent = Math.max(Math.floor(Math.log10(num)), 0); // 0 for 1-9, 1 for 10-99, 2 for 100-999 etc, clamped to 0 for num < 1
	const suffixPosn = Math.min(Math.floor(exponent / 3), suffixes.length - 1);
	const suffixDivisor = Math.pow(10, suffixPosn * 3);
	return `${num/suffixDivisor}${suffixes[suffixPosn]}`;
}


/**
 * Search an object for a value via an array path
 * @param {Object} obj 
 * @param {String[]} path 
 */
export const getObjectValueByPath = (obj, path) => {
	assert(_.isObject(obj), "getObjectValueByPath obj not object?? "+obj);
	assert(_.isArray(path), "getObjectValueByPath path not array?? "+path);
	let tip = obj;
	for(let pi=0; pi < path.length; pi++) {
		let pkey = path[pi];
		assert(pkey || pkey===0, "getObjectValueByPath falsy is not allowed in path: "+path); // no falsy in a path - except that 0 is a valid key
		let newTip = tip[pkey];
		// Test for hard null -- falsy are valid values
		if (newTip===null || newTip===undefined) return null;
		tip = newTip;
	}
	return tip;
};


/**
 * Set an object value via an array path
 * @param {Object} obj 
 * @param {String[]} path 
 */
export const setObjectValueByPath = (obj, path, value) => {
	assert(_.isObject(obj), "setObjectValueByPath obj not object?? "+obj);
	assert(_.isArray(path), "setObjectValueByPath path not array?? "+path);
	let tip = obj;
	for(let pi = 0; pi < path.length; pi++) {
		let pkey = path[pi];
		if (pi === path.length-1) {
			// Set it!
			tip[pkey] = value;
			break;
		}
		assert(pkey || pkey === 0, `falsy in path ${path.join(' -> ')}`); // no falsy in a path - except that 0 is a valid key
		let newTip = tip[pkey];
		if (!newTip) {
			if (value === null) {
				// don't make path for null values
				return value;
			}
			newTip = tip[pkey] = {};
		}
		tip = newTip;
	}
}

/**
 * Comparator for sorting data items alphabetically
 * @param {*} a 
 * @param {*} b 
 */
export const alphabetSort = (a, b) => (a.name || a.id || '').localeCompare(b.name || b.id);


/** Bytes to human-readable b/kb/mb/gb. 
 * @param {?Number} b 
 * @returns {?String}
*/
export const bytes = (b) => {
	if ( ! b && b !== 0) return null; // unset
	if (b < 1024) return `${b} bytes`;
	if (b < 1024000) return `${(b/1024).toFixed(1)} KB`
	if (b < 1024000000) return `${(b/1024000).toFixed(1)} MB`;
	return `${(b/1024000000).toFixed(1)} GB`;
};


/**
 * Is the given string (probably) a HTML page or fragment?
 * Ask the browser to try and make a DOM out of it, and see if it has any children.
 * Will give a "false" negative - because a text node is still a "HTML fragment" - if there are no tags.
 * Reasonable for the current use case of "do we treat this string as an ad tag?" but beware if reusing.
 * Doesn't care if the string causes a parsing error - if it's HTML-like enough to do so, we call it HTML.
 * NB probably somewhat expensive, avoid putting in a render function.
 * @param {string} str String which may be HTML
 * @returns {boolean} True if the document resulting from parse has any nodes in the head or body
 */
export function isHTML(str) {
	let val = false;
	try {
		const parser = new DOMParser();
		const tree = parser.parseFromString(str, 'text/html');
		// Tags like <script> and <style> get stuffed in document.head, displayable ones in document.body
		val = !!(tree.body.children.length + tree.head.children.length);
	} catch {}
	return val;
}


/**
 * Is the given string parseable as a URL with "new URL(str)"?
 * Utility function which exists to contain ESLint warnings in one place.
 * @param {string} str String which may be a URL
 * @returns {boolean} True if the URL constructor doesn't throw.
 */
export function isURL(str) {
	try {
		/* eslint-disable no-new */
		new URL(str);
		/* eslint-enable no-new */
		return true;
	} catch (e) {
		return false;
	}
}


/**
 * Update a React-controlled input element's value as if from user input, triggering onChange etc
 * @param {HtmlElement} el The input
 * @param {*} value The new value
 */
export function setInputValue(el, value) {
	Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, value);
	el.dispatchEvent(new Event('input', { bubbles: true }));
}
