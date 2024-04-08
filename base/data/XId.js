/**
 * Replaces wwutils XId (copy pasta from there)
 */

import _ from 'lodash';
import { assert, assMatch } from '../utils/assert';

/**
 * An id string of the form "identifier@service", e.g. "winterstein@twitter" or "daniel@good-loop.com@email"
 */
class XId extends String {};
// TODO how do we replace the constructor so it returns a string?
// DataClass.register(XId, "XId");
const This = XId;
export default XId;

/**
 * A constant for an unknown person, from an unset service
 */
XId.ANON = "anon@unset";

/**
 * @param {?String} xid
 * TODO check ! isEmail()
 */
XId.isa = xid => xid && xid.indexOf && xid.indexOf('@') > 0;
XId.assIsa = xid => assert(XId.isa(xid), "Not an XId: "+xid);

/**
 * @param {string} xid
 * @returns {string} the id part of the XId, e.g. "winterstein" from "winterstein@twitter"
 */
XId.id = function(xid) {
	if ( ! xid) {
		throw new Error("XId.id - no input "+xid);
	}
	var i = xid.lastIndexOf('@');
	assert(i!=-1, "XId.js - id: No @ in xid "+xid);
	return xid.substring(0, i);
};

/**
 * Convenience for nice display. Almost equivalent to XId.id() -- except this dewarts the XId.
 * So it's better for public display but cannot be used in ajax requests.
 * @param xid Does not have to be a valid XId! You can pass in just a name, or null.
 * @returns the id part of the XId, e.g. "winterstein" from "winterstein@twitter", "bob" from "p_bob@youtube"
 */
XId.dewart = function(xid) {
	if ( ! xid) return "";
	assert(_.isString(xid), "XId.js - dewart: xid is not a string! " + xid);
	// NB: handle invalid XId (where its just a name fragment)
	var id = xid.indexOf('@') == -1? xid : XId.id(xid);
	if (id.length < 3) return id;
	if (id.charAt(1) != '_') return id;
	var c0 = id.charAt(0);
	if (c0 != 'p' && c0 != 'v' && c0 != 'g' && c0 != 'c') return id;
	// so there (probably) is a wart...
	var s = xid.indexOf('@') == -1? '' : XId.service(xid);
	if (s !== 'twitter' && s !== 'facebook') {
		return id.substring(2);
	}
	return id;
};

/**
 * @param {!string} xid
 * @returns {string} the service part of the XId, e.g. "twitter"
 */
XId.service = function(xid) {
	assert(_.isString(xid), "XId.js service(): xid is not a string! " + xid);
	var i = xid.lastIndexOf('@');
	assert(i != -1, "XId.js service(): No @ in xid: " + xid);
	return xid.substring(i + 1);
};

/**
 * @param xid Can be null (returns "") or not an XId (returns itself)
 * @returns the first chunk of the XId, e.g. "daniel" from "daniel@winterwell.com@soda.sh"
 * Also dewarts. Will put a leading @ on Twitter handles.
 */
XId.prettyName = function(xid) {
	if ( ! xid) return "";
	if ( ! XId.isa(xid)) {
		return xid;
	}
	var id = XId.dewart(xid);
	var i = id.indexOf('@');
	if (i != -1) {
		id = id.substring(0, i);
	}
	// @alice for Twitter
	const service = XId.service(xid);
	if (xid.indexOf('@') !== -1 && service === 'twitter') {
		id = '@' + id;
	}
	// Web? shorten the url
	if (service==='Web') {
		// TODO how to shorten a url? crib from SoDash
	}
	return id;
};

/**
 * @param id
 * @param service
 * @returns An xid string in the form 'id@service'
 */
 XId.xid = function(id, service) {
 	assert(_.isString(id), "XId.js xid(): id is not a string! " + id);
 	assert(_.isString(service), "XId.js xid(): service is not a string! " + service);
 	return id + '@' + service;
 }
