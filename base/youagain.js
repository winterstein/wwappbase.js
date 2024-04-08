/**
youagain.js - Login and authentication (oauth) 
Uses json web tokens

Assumes:
	jquery, cookie-js

	Depends on an external web-server (login.soda.sh). 
	Depends on you-againServlet.java
*/

/**
	@typedef {Object} User
	@property {!string} xid 
	@property {?string} name 
	@property {!string} service e.g. "twitter"
	@property {?string} img 
	@property {?string} externalUrl 
	@property {?string} status
 */

// convert to npm style?? But its nice that this will work as is in any app.
import $ from 'jquery';
import { assert } from './utils/assert';
import Cookies from 'js-cookie';
import { noVal } from './utils/miscutils';

// Code for if used outside of npm
// // MUST have js-cookie and SHOULD have assert
// if (typeof (assert) === 'undefined') {
// 	console.warn("Login: creating assert. Recommended: import assert");
// 	window.assert = function (betrue, msg) {
// 		if (!betrue) throw new Error("assert-failed: " + msg);
// 	};
// }
// if (typeof (Cookies) === 'undefined') {
// 	if (window.Cookies) {
// 		let Cookies = window.Cookies;
// 	} else {
// 		// try a require (should work in node, and maybe in the browser if you have a require function defined)
// 		let Cookies = require('js-cookie');
// 	}
// 	// import Cookies from 'js-cookie'; Avoid ES6 for now
// }
// assert(Cookies && Cookies.get, "Please install js-cookie! See https://www.npmjs.com/package/js-cookie");

/**
 * make cookies widely available across the site
 */
const COOKIE_PATH = '/';
const COOKIE_DOMAINS = [null,'.good-loop.com']; // HACK this site + You-Again and Profiler
/**
 * Convenience to set cookie with path, SameSite=None, secure=true
 * 
 * FIXME This quietly fails on localstudio?! Possibly an http vs https thing??
 * Should we use cookie + localStorage??
 * 
 * @param {!String} key 
 * @param {String} val 
 */
const setCookie = (key, val) => {
	console.log("Login", "setCookie", key, val);
	if (noVal(val)) {
		console.log("Cookie set = remove", key);
		removeCookie(key);
		return;
	}
	COOKIE_DOMAINS.forEach(
		domain => Cookies.set(key, val, { path: COOKIE_PATH, sameSite: 'None', secure: true, domain})
	);
};
const getCookie = key => Cookies.get(key);
// NB: the remove path MUST match the set path or remove fails
const removeCookie = key => {
	COOKIE_DOMAINS.forEach(
		domain => Cookies.remove(key, { path: COOKIE_PATH, domain })
	);
}

// Does the url reuqest that we set a first party cookie? The server sets a redirect parameter, and we set a my-site cookie
try {
	let url = new URL(window.location);
	let cj = url.searchParams.get("ya_c");
	if (cj) {
		let c = JSON.parse(cj);
		setCookie(c.name, c.value);
	}
} catch (err) {
	console.warn("you-again url -> 1st party cookie failed", err);
}

class _Login {
	/** You-Again version */
	version = "0.9.4";
	/** This app, as known by you-again. You MUST set this! */
	app;
	/** aka `issuer` Allows for grouping several apps under one banner. */
	dataspace;
	/** 
	 * @type {User[]} An array of user-info objects. E.g. you might have a Twitter id and an email id.
	You could even have a couple of email ids. Always includes Login.user. */
	aliases;
	/** @type {User} The id they last logged in with. */
	user;
	/** @type {id, text} Error message, or null */
	error;
	/** @type {type, id, text} Info message, or null */
	info;
	/** with auth() by Twitter -- where to redirect to on success. Defaults to this page. */
	redirectOnLogin;
	/** The server url. Change this if you use a different login server. */
	ENDPOINT = 'https://youagain.good-loop.com/youagain.json';
	// ENDPOINT = 'https://localyouagain.good-loop.com/youagain.json'

	PERMISSIONS = {
		/** Get an ID to identify who this is, but no more. */
		ID_ONLY: 'ID_ONLY',
		READ: 'READ',
		/** indicates "ask for all the permissions you can" */
		ALL: 'ALL'
	};

	/** @returns {Boolean} true if logged in, and not a temp-id. NB: does not ensure a JWT token is present */
	isLoggedIn() {
		// Should we require user.jwt? But it might not be here but be present in cookies.
		return Login.user && Login.user.service !== 'temp';
	}

	/**
	@param {?string} service Optional selector
	@return {User} The (first) user for this service, or null.
	*/
	getUser(service) {
		if (!Login.user) return null;
		if (!service || Login.user.service === service) return Login.user;
		if (!Login.aliases) {
			return null;
		}
		for (let alias of Login.aliases) {
			assert(alias.xid, alias);
			if (getService(alias.xid) === service) {
				return alias;
			}
		}
		// HACK an xid in the user?
		if (Login.user && Login.user.xids && Login.user.xids[service]) {
			return {
				xid: Login.user.xids[service],
				xids: Login.user.xids
			}; // not much we can say about them!
		}
		return null;
	};


	/**
	@param {?string} service  Optional selector
	@return {string} The (first) xid for this service, or null. E.g. "moses@twitter"
	*/
	getId(service) {
		let u = Login.getUser(service);
		if (!u) {
			return null;
		}
		return u.xid;
	};

	getStatus(service) {
		let u = Login.getUser(service);
		if (!u) {
			return null;
		}
		return u.status;
	};

	/** Is the user signed in? Check with the server.
	@returns {Promise} for a user, and sets the local login state */
	verify() {
		if (pVerify) {
			return pVerify; // don't repeat call if a call is in progress
		};
		console.log("start login...");
		// support for a jwt in the url eg for a pseudo user to enable sharing
		// ?? how does this interact with other jwts if the user is logged in??
		let m = (window.location.hash+window.location.search).match(/jwt=([^&]+)/);
		let jwt = m? m[1] : null;
		console.log("JWT from url", jwt);
		// call the server...
		pVerify = apost(Login.ENDPOINT, { action: 'verify', jwt })
			.then(function (res) {
				if (!res || !res.success) {
					logout2();
				} else {
					setStateFromServerResponse(res);
				}
				return res;
			}).fail(function (res) {
				console.warn("login.verify fail", res, res.status);
				if (res && res.status && res.status >= 400 && res.status < 500) {
					// 40X (bad inputs) logout
					logout2();
				}
				// 50X? no-op
				return res;
			});
		// Remove jwt in url after logged in to avoid logging in again after refresh
		if (jwt) {
			window.history.pushState({}, '', window.location.pathname + window.location.search.replace('&jwt='+jwt, ''))
		}
		return pVerify;
	};

	/** @returns {Promise} */
	logout() {
		console.log("logout");
		const serverResponse = apost(Login.ENDPOINT, { action: 'logout' });
		logout2();
		clear();
		return serverResponse;
	};


	login(person, password) {
		if (!password) {
			console.log("#login: no password for " + person);
			setLoginError({ id: 'missing-password', text: 'Missing input: Password' });
			return Promise.resolve(null); // fail
		}
		return login2({ action: 'login', person, password });
	};

	/**
	 * 
	 * @param {{txid:XId}} loginInfo 
	 * @returns 
	 */
	getJWT(loginInfo) {
		loginInfo.action = 'getjwt';
		// copy pasta from login() without the state edits
		loginInfo.nonce = guid();
		let pLogin = apost(Login.ENDPOINT, loginInfo);
		return pLogin;
	};

	/**
	 * List things shared with user.
	 * You are advised to cache this!
	 * @returns {Promise<Share[]>}
	 */
	getSharedWith(args) {
		let request = apost(Login.ENDPOINT, {
			action: 'shared-with', 
			prefix: args && args.prefix
		});
		return request;
	}
}; // ./ Login class
const Login = new _Login();

/**
 * Avoid repeated calls to verify()
 */
let pVerify;

// Export the Login module
window.Login = Login;
// if (typeof module !== 'undefined') {
// 	module.exports = window.Login;
// }

const callbacks = [];
/**
@param callback will be called with Login.user if the state changes.
If callback is not given -- this simulates a change (a la jquery);
*/
Login.change = function (callback) {
	if (callback) {
		//assertMatch(callback, Function);
		callbacks.push(callback);
		return;
	}
	for (const cb of callbacks) {
		cb(Login.aliases);
	}
};

/**
@return {string} A temporary unique id. This is persisted as a cookie.
You can use this before the user has logged in.
*/
Login.getTempId = function () {
	let u = Login.getUser('temp');
	if (u) return u.xid;
	// make a temp id
	let tempuser = {
		name: 'Temporary ID',
		xid: guid() + '@temp',
		service: 'temp',
	};
	// with an empty unsigned JWT token
	tempuser.jwt = tempuser.xid; // HACK - matches server-side hack
	// TODO a proper unsigned JWT token b64enc(JSON.stringify({alg:"none",typ:"JWT"}))+"."+b64enc("{xid:u.xid}")+".x"
	setUser(tempuser);
	// provide a webtoken too
	setCookie(COOKIE_UXID, tempuser.xid);
	return tempuser.xid;
};

const guid = function () {
	// A Type 4 RFC 4122 UUID, via http://stackoverflow.com/a/873856/346629
	let s = [];
	let hexDigits = "0123456789abcdef";
	for (let i = 0; i < 36; i++) {
		s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
	}
	s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
	s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
	s[8] = s[13] = s[18] = s[23] = "-";
	let uuid = s.join("");
	return uuid;
};


/**
 * An email address for the current user.
 * This is NOT necc a verified email - use it at your own risk.
 * For a more cautious approach, use `Login.getUser('email')`
 */
Login.getEmail = function () {
	let emailXId = Login.getId('email');
	if (emailXId) {
		let i = emailXId.lastIndexOf('@');
		return emailXId.substr(0, i);
	}
	// stab in the dark -- does the user have an email property?
	// This also provides a handy place where email can be stored on non-email (inc temp) users.
	let user = Login.getUser();
	let e = user && user.email;
	return e;
};

const COOKIE_UXID = "uxid";
const COOKIE_JWT = "jwt";
/** Cookies beginning with this are added to post requests and removed on logout. 
 * So we can hold logins for multiple apps in the cookie jar */
const cookieBase = () => Login.app + ".jwt";

const setLoginError = err => {
	if (!err) return;
	console.error("#login.setError", err);
	Login.error = err;
};

const setLoginInfo = info => {
	if (!info) return;
	console.error("#login.setInfo", info);
	Login.info = info;
};

const setStateFromServerResponse = function (res) {
	console.log('setStateFromServerResponse', res);
	if (res.errors && res.errors.length) {
		// stash the error for showing to the user
		setLoginError(res.errors[0]);
		return res;
	}
	if (res.messages && res.messages.length) {
		// stash the info for showing to the user
		setLoginInfo(res.messages.filter(message => message.type === 'info')[0])
		return res;
	}
	let newuser = res.cargo && res.cargo.user;
	// {User[]}
	let newaliases = res.cargo && res.cargo.aliases && res.cargo.aliases.slice();
	// check the cookies (which may have changed)
	let cuxid = getCookie(COOKIE_UXID);
	if (cuxid && !newuser) newuser = { xid: cuxid };
	if (!newaliases) newaliases = [];
	// Not logged in?
	if (!newuser) {
		logout2();
		return res;
	}
	// prefer a non-temp user
	if (getService(newuser.xid) === 'temp' || getService(newuser.xid) === 'trk') {
		for (let i = 0; i < newaliases.length; i++) {
			const alias = newaliases[i];
			if (getService(alias.xid) === 'temp' || getService(alias.xid) === 'trk') continue;
			newuser = alias;
			break;
		}
	}
	setUser(newuser, newaliases);
	// clear the error and info
	Login.error = null;
	Login.info = null;
	return res;
};

let getService = function (xid) {
	assert(typeof (xid) === 'string', xid);
	let i = xid.lastIndexOf('@');
	assert(i != -1, "CreoleBase.js - service:Not a valid XId No @ in " + xid);
	return xid.substring(i + 1);
};


/**
 * This is normally for internal use. It calls Login.change().
 * 
 * Side effects: sets a cookie for their xid and jwt
 * @param {User} newuser
 * @param {?User[]} newaliases 
 */
let setUser = function (newuser, newaliases) {
	console.log("setUser", newuser, newaliases);
	let oldxid = Login.user && Login.user.xid;
	if (Login.user && Login.user.xid === newuser.xid) {
		// keep old info... but newuser overrides
		newuser = Object.assign({}, Login.user, newuser);
		// TODO extend aliases
	}
	// set user
	Login.user = newuser;
	// service
	if (!Login.user.service) {
		Login.user.service = getService(Login.user.xid);
	}
	// set aliases
	if (newaliases && newaliases.length !== 0) {
		Login.aliases = newaliases;
		assert(newaliases[0].xid, newaliases);
	} else if (newuser.xid === oldxid) {
		// leave as is
	} else {
		// aliases = just the user
		Login.aliases = [newuser];
	}
	// cookies
	setCookie(COOKIE_UXID, Login.user.xid);
	if (Login.user.jwt) setCookie(COOKIE_JWT, Login.user.jwt);
	// webtoken: set by the server
	if (oldxid != newuser.xid) {
		Login.change();
	}
}; // ./setUser
// expose this for advanced external use!
Login.setUser = setUser;

Login.loginForm = function (el) {
	let $form = $(el).closest('form');
	let peep = $form.find('input[name=person]').val();
	let password = $form.find('input[name=password]').val();
	console.warn("#login peep", peep, password);
	return Login.login(peep, password);
}

/**
 * Clear local transient state
 */
const clear = () => {
	pVerify = null;
};

const login2 = function (loginInfo) {
	// clear any cookies
	logout2();
	clear();
	// now try to login
	loginInfo.nonce = guid();
	let pLogin = apost(Login.ENDPOINT, loginInfo);
	pLogin = pLogin.then(setStateFromServerResponse, res => {
			Login.error = { id: res.statusCode, text: res.responseText || res.statusText };
		});
	return pLogin;
};

/**
* Register a new user, typically with email & password
@param {{email:string, password:string}} registerInfo + other info??
*/
Login.register = function (registerInfo) {
	registerInfo.action = 'signup';
	return login2(registerInfo);
};

/**
 * Like register() but for an authorised user to register other people
 * @param {{email:string, person:XId, password:string, name:?string}} registerInfo
 * @returns {Promise} Unlike register(), no processing is done with this
 */
Login.registerStranger = function (registerInfo) {	
	registerInfo.action = 'register';
	registerInfo.by = Login.getId();
	registerInfo.nonce = guid();
	let pLogin = apost(Login.ENDPOINT, registerInfo);
	return pLogin;
};


/**
 * Authorise via Twitter etc. This will redirect the user away!
@param service {string} e.g. twitter
@param appId {string} Your app-id for the service, e.g. '1847521215521290' for Facebook
@param permissions {string?} what permissions do you need? See Login.PERMISSIONS
@returns Nothing! TODO a future would be nice
*/
Login.auth = function (service, appId, permissions) {
	// Facebook via their API?
	if (service === 'facebook') {
		assert(appId, "Please provide a FB app id");
		if (window.FB) {
			return doFBLogin();
		}
		Login.onFB_doLogin = true;
		Login.prepFB(appId);
		return;
	} // ./fb

	// via the you-again server
	window.location = Login.ENDPOINT + "?action=get-auth&app=" + escape(Login.app)
		+ "&appId=" + escape(appId) + "&service=" + service
		+ (permissions ? "&permissions=" + escape(permissions) : '')
		+ "&link=" + escape(Login.redirectOnLogin || window.location);
};

/** load the FB code - done lazy for privacy and speed */
Login.prepFB = function (appId) {
	if (window.FB) return;
	if (Login.preppingFB) return;
	Login.preppingFB = true;
	window.fbAsyncInit = function () {
		FB.init({
			appId: appId,
			autoLogAppEvents: false,
			xfbml: false,
			version: 'v2.9',
			status: true // auto-check login
		});
		// FB.AppEvents.logPageView();
		FB.getLoginStatus(function (response) {
			console.warn("FB.getLoginStatus", response);
			if (response.status === 'connected') {
				doFBLogin_connected(response);
			} else {
				if (Login.onFB_doLogin) {
					doFBLogin();
				}
			}
		}); // ./login status
	};
	(function (d, s, id) {
		let fjs = d.getElementsByTagName(s)[0];
		if (d.getElementById(id)) return;
		let js = d.createElement(s); js.id = id;
		js.src = "//connect.facebook.net/en_US/sdk.js";
		fjs.parentNode.insertBefore(js, fjs);
	}(document, 'script', 'facebook-jssdk'));
}; // ./prepFB


// Annoyingly -- this is likely to fail the first time round! They use a popup which gets blocked :(
// Possible fixes: Load FB on page load (but then FB track everyone)
// TODO Use a redirect (i.e. server side login)
const doFBLogin = function () {
	console.warn("FB.login...");
	FB.login(function (response) {
		console.warn("FB.login", response);
		if (response.status === 'connected') {
			doFBLogin_connected(response);
		} else {
			// fail
		}
	}); //, {scope: 'public_profile,email,user_friends'}); // what permissions??
	// see https://developers.facebook.com/docs/facebook-login/permissions
};

const doFBLogin_connected = (response) => {
	let ar = response.authResponse;
	// ar.userID;
	// ar.accessToken;
	// ar.expiresIn;	
	Login.setUser({
		xid: ar.userID + '@facebook'
	});
	// TODO translate our permissions types into fields
	// ask for extra data (what you get depends on the permissions, but the ask is harmless)
	FB.api('/me?fields=name,about,cover,age_range,birthday,email,gender,relationship_status,website', function (meResponse) {
		console.warn('Successful login for: ' + meResponse.name, meResponse);
		Login.setUser({
			xid: ar.userID + '@facebook',
			name: meResponse.name
		});
		// trigger an update, even though the xid has stayed the same
		Login.change();
		// tell the backend
		let updateInfo = {
			action: "update",
			token: ar.accessToken,
			authResponse: JSON.stringify(ar),
			user: JSON.stringify(Login.getUser()),
			xid: Login.getId()
		};
		apost(Login.ENDPOINT, updateInfo)
			.then(	// JWT from YA has to be stored
				setStateFromServerResponse
			);
	});
}; // ./doFBLogin_connected()


/**
 * Password reset by email
 */
Login.reset = function (email) {
	assert(email);
	const params = {
		email: email,
		action: 'reset'
	}
	let request = apost(Login.ENDPOINT, params)
		.fail(function (req) {
			if (req.responseText) {
				// stash the error for showing to the user
				console.error("#login.state", req.responseText.split('\n')[0]);
				if (req.status == 404) Login.error = 'This account does not exist. Please check that you have typed your email address correctly.';
				else Login.error = req.responseText;
			}
			return req;
		});
	return request;
};

/**
 * Change password.
 * 
 * Note: This is a "higher security" action, and auth tokens aren't considered enough for this.
 */
Login.setPassword = function (email, currentPassword, newPassword) {
	assert(email && currentPassword && newPassword);
	const params = {
		email: email,
		action: 'set-password',
		auth: currentPassword,
		newPassword: newPassword
	}
	let request = apost(Login.ENDPOINT, params);
	return request;
};

/**
 * Verify email.
 */
Login.sendVerify = function (email) {
	assert(email);
	const params = {
		email: email,
		action: 'send-verify'
	}
	let request = apost(Login.ENDPOINT, params);
	return request;
}



/** convenience for ajax with cookies */
const apost = (url, data, type="POST") => {
	assert(Login.app, "You must set Login.app = my-app-name-as-registered-with-you-again");
	data.app = Login.app;
	data.d = Login.dataspace;
	data.withCredentials = true; // let the server know this is a with-credentials call
	data.caller = document.location?.origin + document.location?.pathname; // provide some extra info. truncate the url to avoid shipping eg jwt tokens
	// add in local cookie auth
	const cookies = Cookies.get();
	let cbase = cookieBase();
	for (let c in cookies) {
		if (c.substr(0, cbase.length) === cbase) {
			let cv = getCookie(c);
			data[c] = cv;
			data["src"+c] = "js-cookie";
		}
	}
	// auth on the user?
	if ( ! data.jwt && Login.user && Login.user.jwt) {
		data.jwt = Login.user.jwt;
		data["srcjwt"] = "Login.user";
	}
	// replace without jquery? - but beware of fetch's cookie etc handling
	if (!$ || !$.ajax) {
		console.error("YouAgain requires jQuery or other $.ajax"); l
		return Promise.reject("no $");
	}
	return $.ajax({
		dataType: "json", // not really needed but harmless
		url,
		data,
		type,
		xhrFields: { withCredentials: true }
	});
};

const logout2 = function () {
	console.warn('logout2 - clear stuff'); // use warn so we get a stacktrace
	const cookies = Cookies.get();
	let cbase = cookieBase();
	for (let c in cookies) {
		if (c.substr(0, cbase.length) === cbase) {
			console.log("remove cookie " + c);
			removeCookie(c);
		}
	}
	removeCookie(COOKIE_UXID);
	removeCookie(COOKIE_JWT);
	// local vars
	Login.user = null;
	Login.aliases = null;
	Login.error = null;
	Login.info = null;
	// notify any listeners
	Login.change();
};

Login.logoutAndReload = function () {
	Login.logout();
	window.location.reload();
};

/**
 * "sign" a packet by adding app, as, and jwt token(s)
 * 
 * NB: This will sign proper or temp logins.
 * @param {Object|FormData} ajaxParams. A params object, intended for jQuery $.ajax.
 * ajaxParams.data.{app, as, jwt, withCredentials} are set, as is ajaxParams.withCredentials.
 * @returns the input object
 */
Login.sign = function (ajaxParams) {
	assert(ajaxParams && ajaxParams.data, 'youagain.js - sign: no ajaxParams.data', ajaxParams);
	if (!Login.getUser()) return ajaxParams;
	dataPut(ajaxParams.data, 'app', Login.app);
	dataPut(ajaxParams.data, 'as', Login.getId());
	let jwt = Login.getUser().jwt;
	dataPut(ajaxParams.data, 'jwt', jwt);
	ajaxParams.xhrFields = { withCredentials: true }; // send cookies
	dataPut(ajaxParams.data, 'withCredentials', true); // let the server know this is a with-credentials call
	return ajaxParams;
};

/**
 * Utility to set a key=value pair for FormData (a browser native object) or a normal data map.
 * @param {FormData|Object} formData 
 * @param {String} key 
 * @param {*} value 
 */
const dataPut = function (formData, key, value) {
	if (value == undefined) return;
	// HACK: is it a FormData object? then use append
	if (typeof (formData.append) === 'function') {
		formData.append(key, value);
	} else {
		formData[key] = value;
	}
};

/** 
 * Share puppetXId with ownerXId (i.e. ownerXId will have full access to puppetXId).
 * 
 * Security: The browser must have a token for puppetXId for this request to succeed. 
 * 
 * @param {String} puppetXId Normally Login.getId() But actually this can be any string! This is the base method for shareThing()
 * TODO we should probably refactor that just for clearer naming.
 * @param {String} personXId the user who it is shared with
 * @param {?boolean} bothWays If true, this relation is bi-directional: you claim the two ids are the same person.
 * @param {?String} message Optional message to email to personXId
 * @returns {Promise}
 */
Login.shareLogin = function (puppetXId, personXId, bothWays, message) {
	assert(isString(puppetXId), 'youagain.js shareThing() - Not a String ', puppetXId);
	assert(isString(personXId), 'youagain.js shareThing() - Not an XId String ', personXId);
	let request = apost(Login.ENDPOINT, {
		'action': 'share',
		'entity': puppetXId,
		'shareWith': personXId,
		'equiv': bothWays,
		'message': message
	});
	// request = request.then(setStateFromServerResponse); ??
	return request;
};

/**
 * delete a share
 */
Login.deleteShare = function (thingId, personXId) {
	assert(thingId && personXId, "youagain.js - deleteShare needs more info " + thingId + " " + personXId);
	let request = apost(Login.ENDPOINT, {
		'action': 'delete-share',
		'entity': thingId,
		'shareWith': personXId
	}); // NB: jQuery turns delete into options, no idea why, which upsets the server, 'DELETE');
	// request = request.then(setStateFromServerResponse);
	return request;
};

/**
 * Share something related to your app with another user.
 * The share comes from the current user.
 * @param thingId {String} ID for the thing you want to share. 
 * This ID is app specific. E.g. "/myfolder/mything"
 * @param message {?String} Optional message to email to personXId
 * @returns 
 */
Login.shareThing = function (thingId, personXId, message) {
	// actually they are the same call, but bothWays only applies for shareLogin
	return Login.shareLogin(thingId, personXId, null, message);
}

/**
 * Claim ownership of a thing, which allows you to share it. 
 * First-come first-served: If it has already been claimed by someone else then this will fail.
 * @param thingId {String} ID for the thing you want to share. 
 * This ID is app specific (i.e. app1 and app2 use different namespaces). E.g. "/myfolder/mything"
 */
Login.claim = function (thingId) {
	assert(isString(thingId), 'youagain.js claim() - Not a String ', thingId);
	let request = apost(Login.ENDPOINT, {
		action: 'claim',
		entity: thingId
	});
	return request;
};


/**
 * List things shared by the user.
 * You are advised to cache this!
 * @returns {Promise<Share[]>}
 */
Login.getSharedBy = function () {
	let request = apost(Login.ENDPOINT, {
		action: 'shared-by'
	});
	return request;
}

const isString = x => typeof (x) === 'string';

/**
 * Check whether the user can access this thing. 
 * Returns a share object if there is one, otherwise returns without error but with success:false 
 * You are advised to cache this!
 * @returns {Promise<Share>}
 */
Login.checkShare = function (thingId) {
	assert(isString(thingId), 'youagain.js checkShare() - Not a String ', thingId);
	let request = apost(Login.ENDPOINT, {
		action: 'check-share',
		entity: thingId
	});
	return request;
}


/**
 * List the shares for an object (the user must have access to the thing).
 * You are advised to cache this!
 * @returns {Promise<Share[]>}
 */
Login.getShareList = function (thingId) {
	assert(isString(thingId), 'youagain.js getShareList() - Not a String ', thingId);
	let request = apost(Login.ENDPOINT, {
		action: 'share-list',
		entity: thingId
	});
	return request;
}

// Initialise from cookies
setStateFromServerResponse({});

export default Login;
