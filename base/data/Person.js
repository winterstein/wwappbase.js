/**
 * Profiler sketch API
 * See also the profiler java code, Person.java, and Person.js
 * 
 * The Profiler is a bit complex -- partly as the code is WIP, but partly because the task is complex:
 * Model users "properly", handling multiple overlapping profiles e.g. Facebook / Twitter / email(s)
 * And that seemingly simple flags like "yes-to-cookies" need complex data for audit trails and scope.
 * 
 * Core idea:
 * The user does NOT have one profile. They have several linked profiles. Data may be drawn from any of those.
 * 
 * 
 * TODO maybe merge this with Person.js
 * 
 */

import { assert, assMatch } from '../utils/assert';
import DataClass, {getType, getId, nonce} from './DataClass';
import DataStore, { getDataPath } from '../plumbing/DataStore';
import Link from '../data/Link';
import Claim, { DEFAULT_CONSENT } from '../data/Claim';
import XId from './XId';
import md5 from 'md5';
import PromiseValue from '../promise-value';
import {mapkv, encURI, debouncePV, isEmail} from '../utils/miscutils';
import Cookies from 'js-cookie';
import Enum from 'easy-enums';

import ServerIO from '../plumbing/ServerIOBase';
import { sortByDate } from '../utils/SortFn';
import C from '../CBase';
import JSend from './JSend';
import { crud, localLoad, localSave } from '../plumbing/Crud';
import KStatus from './KStatus';



/**
 * See Person.java
 * 
 * Person is a rich model for profiles
 */
class Person extends DataClass {
	/** @type {!string} main ID */
	id;
	/** @type {!string[]} Can have multiple IDs! Only if they are genuinely 100% equivalent, e.g. twitter username and numerical ID */
	ids;
	/** @type {string} */
	img;
	/** @type {Link[]} */
	links;
	/** @type {Claim[]} */
	claims;

	constructor(base) {
		super(base);
		Object.assign(this, base);
	}
}
DataClass.register(Person, "Person");

// for debug
window.Person = Person;

const This = Person;
export default Person;

/**
 * NB a Person specific one, since this class can have multiple IDs
 * -- though this method is identical to the normal getId()!
 * @param {Person} peep
 * @returns {XId}
 */
Person.getId = peep => peep.id;

Person.img = peep => {
	if ( ! peep) return null;
	if (peep.img) return peep.img;
	const xid = getId(peep);
	if (XId.service(xid) === 'email') {
		const hash = md5(XId.id(xid).trim().toLowercase());
		return 'https://www.gravatar.com/avatar/'+hash;
	}
	return null;
};


/**
 * 
 * @param {Person} peep 
 * @param {String} service
 * @returns {?Link} The (TODO most likely) email link
 */
Person.getLink = (peep, service) => {
	const links = Person.getLinks(peep, service);
	if ( ! links) return null;
	// FIXME sort them by w
	return links[0];
}


/**
 * 
 * @param {Person} peep 
 * @param {?String} service If not provided, return all links
 * @returns {?Link[]} all matching links, or falsy if none
 */
Person.getLinks = (peep, service) => {
	Person.assIsa(peep);
	const links = [];
	// is the XId a match?
	const xid = Person.id(peep);
	if ( ! service || XId.service(xid) === service) {
		links.push(new Link({key:"link", value:xid, from:[xid], w:1}));
	}
	// links
	if ( ! peep.links) {
		return links.length && links;
	}
	// NB: Test claims too? No - lets enforce clean data for ourselves
	// ??filter old trks?
	let matchedLinks = peep.links; //.filter(link => link.v && XId.service(link.v) !== "trk" || link.t);
	if (service) {
		matchedLinks = peep.links.filter(link => link.v && XId.service(link.v) === service);
	}
	links.push(...matchedLinks);
	return links.length && links;
};


/**
 * 
 * @param {?Person} person If unset return false
 * @param {!String} app 
 */
Person.hasApp = (person, app) => {
	if ( ! person) return false;
	Person.assIsa(person, "hasApp");
	const cv = getClaimValue({person, key:"app:"+app, from:person.id});
	return !! cv;
};


/**
 * Set and save
 * @param {!Person} person 
 * @param {!String} app 
 */
Person.setHasApp = (person, app) => {
	Person.assIsa(person, "setHasApp");
	assMatch(app,String);
	setClaimValue({person, key:"app:"+app, value:true});
	savePersons({person});
};


/**
 * See Purposes.java
 */
const PURPOSES = new Enum("any email_app email_mailing_list email_marketing preregister cookies cookies_personalization cookies_analytical cookies_marketing cookies_functional personalize_ads");


/**
 * Sets dataspace and type
 * @returns {!String[]}
 */
const getPersonDataPath = ({id,status=KStatus.PUBLISHED}) => {
	assert(id, "getPersonDataPath() no `id`");
	let domain = C.app.dataspace || ServerIO.dataspace;
	const dsi = {type:"Person", status, id, domain};
	const dpath = getDataPath(dsi);
	return dpath;
};


/**
 * Get local or fetch
 * @param {?Object} p 
 * @param {?String} p.xid If unset, use Login.getId()
 * TODO fields 
 * @returns !PromiseValue(Person) This will _always_ have either .value or .interim set.
 */
const getProfile = ({xid, fields, status=KStatus.PUBLISHED, swallow=true}={}) => {
	if ( ! xid) xid = Login.getId();
	if ( ! xid) {
		return new PromiseValue(null);
	}
	// domain:ServerIO.dataspace??
	const type = 'Person';
	const dpath = getPersonDataPath({id:xid,status});

	// To allow immeadiate edits, we return an interim item
	let interim = DataStore.getValue(dpath);
	if ( ! interim) { // Do we have a fast local answer?
		interim = localLoad(dpath);
	}
	if ( ! interim) { // make a new blank 
		// NB: note that DS.fetch will cache equivalent requests, so we should be protected against having multiple versions of interim at once.
		interim = new Person({id:xid, interimId:"i"+nonce()});
		// console.warn("new interim Person",interim.interimId);
	}

	// Use DS.fetch to avoid spamming the server
	let pvProfile = DataStore.fetch(dpath, () => {
		// Do it!
		let p = crud({action:"get", type:'Person', status, id:xid, item:interim, swallow, localStorage:false});
		return p;
	}, {cachePeriod}); // ./DS.fetch

	// NB: DS.fetch will cache and return a promise, so don't set the new interim if we already had one
	if ( ! pvProfile.resolved && ! pvProfile.interim) { // NB: crud can sometimes return an instantly resolved PV, in which case an interim would be wrong.
		// IF ! pvProfile.resolved, then edits to interim will work - crud will detect edits via diff and merge them in when it resolves the promise
		pvProfile.interim = interim;
		console.log("interim Person in use "+interim.interimId);
	}
	return pvProfile;
};


/**
 * HACK
 * @param {Person} person 
 * @returns {?String} email
 */
Person.getEmail = person => {
	if ( ! person) return null;
	let id = Person.getId(person);
	let e = XId.id(id);
	if (isEmail(e)) {
		return e;
	}
	// links
	let elinks = Person.getLinks(person, "email");
	if (elinks.length) {
		const el0 = elinks[0];
		e = Link.to(el0);
		return e;
	}
	return null;
};


/**
 * 
 * @param {Person|PersonLite} p
 * @returns PromiseValue(Person)
 */
const getProfileFor = ({xid,service}) => {
	const pvPeep = getProfile({xid});
	if ( ! pvPeep.resolved) return pvPeep; // HACK not quite correct! e.g. If you attach a then!
	if (XId.service(xid) === service) {
		return pvPeep;
	}
	const link = Person.getLink(pvPeep.value, service);
	if ( ! link) return new PromiseValue(null);
	const sxid = Link.to(link);
	const pvPeep2 = getProfile({sxid});
	return pvPeep2;
};


// one hour in msecs DS cache
const cachePeriod = 1000*60*60;


/**
 * Convenience method:
 * Fetch the data for all xids. Return profiles which can be a mix of local-loaded, fetched, or blank interim objects (which temporarily support edits via merging).
 * e.g.
 * ```
 * let persons = getProfilesNow(getAllXIds());
 * let value = getClaimValue({persons, key:'name'});
 * ```
 * @param {?String[]} xids Defaults to `getAllXIds()`
 * @returns {Person[]} peeps The can be loaded, fetched, or interim!
 */
const getProfilesNow = xids => {
	if ( ! xids) xids = getAllXIds();
	assert(_.isArray(xids), "Person.js getProfilesNow "+xids);
	xids = xids.filter(x => x); // no nulls
	let pvsPeep = xids.map(xid => getProfile({xid}));
	let peeps = pvsPeep.map(pvp => pvp.value || pvp.interim).filter(x => x);
	console.log("xids", xids, "pvsPeep", pvsPeep, "peeps", peeps);
	return peeps;
};


/**
 * TODO refactor into Crud
 * A debounced save - allows 1 second for batching edits
 * Create UI call for saving claims to back-end
 * @param {Person} persons
 * @param {Person[]} persons
 * @returns PromiseValue
 */
const savePersons = debouncePV(({person, persons}) => {
	if (person) {
		assert( ! persons);
		persons = [person];
	}
	// one save per person ?? TODO batch
	let pSaves = persons.map(peep => {
		Person.assIsa(peep);
		// Proper save
		let claims = peep.claims;
		// TODO filter for our new claims, maybe just by date, and send a diff
		if( _.isEmpty(claims) ) {
			console.warn('Person.js saveProfileClaims -- no claims provided, aborting save');
			return null;
		}
		let xid = Person.getId(peep);
		let p = ServerIO.post(
			`${ServerIO.PROFILER_ENDPOINT}/profile/${ServerIO.dataspace}/${encURI(xid)}`, 
			{claims: JSON.stringify(claims)}
		);
		// local save
		let path = getPersonDataPath({status:KStatus.PUBLISHED, id:peep.id});
		localSave(path, peep);
		return p;
	});
	// join them
	let pSaveAll = Promise.allSettled(pSaves);
	return pSaveAll;
}, 1000);


/**
 * A debounced save - allows 1 second for batching edits
 * Create UI call for saving consents to back-end
	@param {Person[]} persons
*/ 
const saveConsents = _.debounce(({persons}) => {
	// one save per person ?? TODO batch
	let pSaves = persons.map(peep => {
		Person.assIsa(peep);
		// string[] -- send as a comma-separated list
		let consents = peep.c;
		if ( ! consents || ! consents.length) {
			return null;
		}
		// ??send a diff??
		let xid = Person.getId(peep);
		return ServerIO.post(
			`${ServerIO.PROFILER_ENDPOINT}/profile/${ServerIO.dataspace}/${encURI(xid)}`, 
			{consents:consents.join(",")}
		);
	});
	// filter any nulls
	pSaves = pSaves.filter(p => p);
	// join them
	let pSaveAll = Promise.allSettled(pSaves);
	return pSaveAll; // wrap in a PV??
}, 1000);


/**
 * This does NOT fetch any fresh data - it extracts data from the input Person object.
 * The underlying consents model is rich (it can carry more options and audit info). 
 * We mostly want to work with something simple.
 * 
 * @param {?Person} person
 * @param {?Person[]} profiles Use this to combine from several linked profiles
 * @param {?string[]} xids Convenience for `profiles` using `getProfilesNow`.
 * @returns {String: Boolean} never null, empty = apply sensible defaults
 */
const getConsents = ({person, persons, xids}) => {
	if (xids) {
		assert( ! persons, "xids + profiles?!");
		persons = getProfilesNow(xids);
	}
	// several profiles?
	if (persons) {
		let debugWho4c = {};
		// combine them
		let perms = {};
		persons.forEach(peep => {
			if ( ! peep) {
				return; // paranoia
			}
			// hm - prefer true/false/most-recent??
			let peepPerms = getConsents({person:peep});
			if (peepPerms) {
				Object.assign(perms, peepPerms);
				Object.keys(peepPerms).forEach(c => debugWho4c[c] = peep.id);
			}
		});
		console.log("getConsents who4c",debugWho4c,"perms",perms);
		return perms;
	}
	// one person
	Person.assIsa(person);
	// convert list-of-strings into a true/false map
	let pmap = {};
	let consents = person.c || [];
	consents.forEach(c => {
		if (c[0] === "-") {
			c = c.substr(1);
			pmap[c] = false;
		} else {
			pmap[c] = true;
		}
	});
	// done
	return pmap;
};


/**
 * This does NOT fetch any fresh data - it extracts data from the input Person object.
 * The underlying consents model is rich (it can carry more options and audit info). 
 * We mostly want to work with something simple.
 * 
 * @param {?Person} person
 * @param {?Person[]} persons Use this to combine from several linked profiles
 * @param {?string[]} xids Convenience for `profiles`.
 * @param {!string} purpose The purpose ID of the consent you want
 * @returns {Boolean} 
 */
const hasConsent = ({person, persons, xids, purpose}) => {
	assMatch(purpose, String);
	const cs = getConsents({person, persons, xids});
	return cs[purpose];
};


/** Puts consents in to form used by back-end 
 * @param consents {String: Boolean} 
 * NB: handles the "yes"/"no" case
 * @returns {String[]} consents and -consents
*/
const convertConsents = (consents) => mapkv(consents, (k,v) => (v===true || v === "yes" || v===1) ? k : "-"+k);


/**
 * @param consents {String: Boolean}
 * 
 * Does NOT save
 */
const setConsents = ({person, consents}) => {
	Person.assIsa(person);
	assert( ! _.isArray(consents), "Person.js use a map: "+consents);

	let pstrings = convertConsents(consents);

	// Audit trail of whats changed? TODO manage that server-side.
	person.c = pstrings;
	return person;
};


/**
 * @deprecated confusion with Person.getEmail()
 * Convenience for "find a linked profile for email, or null"
 * @returns {?string} email
 */
const getEmail = ({xids}) => {
	let exid = xids.find(xid => XId.service(xid)==="email");
	if (exid) {
		return XId.id(exid);
	}
	return null;
};


/**
 * Call AnalyzeDataServlet to fetch and analyse Twitter data.
 * 
 * ??update DataStore here??
 */
const requestAnalyzeData = xid => {
	assMatch(xid, String);
	// NB: analyze is always for the gl dataspace
	return ServerIO.load(ServerIO.PROFILER_ENDPOINT + '/analyzedata/gl/' + escape(xid));
};


/**
 * Warning: This races Login and profile fetch for handling linked ids -- so the results can change!
 * 
 * @returns {String[]} xids - includes unverified linked ones
 */
const getAllXIds = () => {
	// use Set to dedupe
	let all = new Set(); // String[]
	// ID
	if (Login.isLoggedIn()) {
		all.add(Login.getId());
	}
	// cookie tracker
	let trkid = Cookies.get("trkid");
	if (trkid) all.add(trkid);
	// aliases
	if (Login.aliases) {
		let axids = Login.aliases.map(a => a.xid);
		axids.forEach(a => all.add(a));
	}
	// linked IDs?
	getAllXIds2(all, Array.from(all));
	// turn into an array
	let aall = Array.from(all);
	// HACK: prune down to the main ones
	let all2 = aall.filter(xid => XId.service(xid)!=='trk');
	if (all2.length) aall = all2;
	// done
	return aall;
};


/**
 * @param {Set<String>} all XIds -- modify this!
 * @param {String[]} agendaXIds XIds to investigate
 */
const getAllXIds2 = (all, agendaXIds) => {
	// ...fetch profiles from the agenda
	let pvsPeep = agendaXIds.map(xid => getProfile({xid}));
	// races the fetches -- so the output can change as more data comes in!
	// It can be considered done when DataStore holds a profile for each xid
	pvsPeep.filter(pvp => pvp.value).forEach(pvp => {
		let peep = pvp.value;
		let linkedIds = Person.getLinks(peep).map(Link.to);
		if ( ! linkedIds) return;
		// loop test (must not already be in all) and recurse
		let newIds = linkedIds.filter(li => li && ! all.has(li));
		newIds.forEach(li => {
			all.add(li);
			getAllXIds2(all, [li]);
		});
	});
};


/**
 * Process a mailing-list sign-up form
 * @param {!String} email
 * @param {?String} controller Who "owns" this data? Defaults to `ServerIO.dataspace`
 * @param {?String} purpose Why? See PURPOSES
 * @param {?String} notify Our email to send a note to
 */
const doRegisterEmail = (data) => {
	let email = data.email;
	if ( ! email) {
		console.error("Person.js - Cannot process - no email");
		return;
	}
	if ( ! data.controller) data.controller = ServerIO.dataspace;
	if ( ! data.ref) data.ref = ""+window.location;
	// This will become a standard consent "I grant consent purpose=email_mailing_list to the data-controller"
	if ( ! data.purpose) {
		data.purpose = PURPOSES.email_mailing_list;
	}
	if ( ! data.evt) data.evt = "register";
	data.app = C.app.id;

	return ServerIO.load(`${ServerIO.PROFILER_ENDPOINT}/form/${ServerIO.dataspace}`, {data})
};


/**
 * Does NOT call `savePersons()`
 * @param {!string} consent
 */
const addConsent = ({persons, consent}) => {
	persons.forEach(person => {
		let consents = person.c;
		if ( ! consents) consents = person.c = [];
		if (consents.includes(consent)) return;
		consents.push(consent);
	});
	console.error("addConsent",persons,consent);
};


/**
 * 
 * @param {!string} consent
 */
const removeConsent = ({persons, consent}) => {
	persons.forEach(person => {
		let consents = person.c;
		if ( ! consents) return;
		person.c = person.c.filter(pc => pc !== consent);
	});
	console.error("removeConsent",persons,consent);
};


/**
 * Locally set a claim value (does NOT save -- use `savePersons()` to save)
 * @param {Object} p
 * @param {!Person[]} p.persons
 * @param {!String} p.key
 * @param {?String} p.consent e.g. "public"
 */
const setClaimValue = ({person, persons, key, value, consent}) => {
	if (person) persons = [person];
	assert(persons, "Person.js setClaimValue() - No person or persons input! key: "+key);
	if ( ! persons.length) console.warn("setClaimValue - no persons :( -- Check profile load is working");
	console.log("setClaimValue "+key+" = "+value, persons.map(p => p.id));
	let from = Login.getId() || XId.ANON;
	let consents = [consent || DEFAULT_CONSENT]; // the "what is my current default?" setting
	let claim = new Claim({key,value,from,consent:consents});
	persons.map(peep => {
		addClaim(peep, claim);
	});
};


/**
 * Locally delete a claim value (does NOT save -- use `savePersons()` to save)
 * @param {Object} p
 * @param {!Person[]} p.persons
 * @param {!String} p.key
 */
const deleteClaim = ({persons, key}) => {
	setClaimValue({persons, key, value:"DELETED"});
};


const addClaim = (peep, claim) => {
	Person.assIsa(peep);
	Claim.assIsa(claim);
	if ( ! peep.claims) peep.claims = [];

	// Does it replace a claim? - remove overlaps
	let overlaps = peep.claims.filter(oldClaim => Claim.overlap(claim, oldClaim));
	// NB: called `newclaims` cos it will replace peep.claims below
	let newclaims = peep.claims.filter(oldClaim => ! Claim.overlap(claim, oldClaim));
	// add it
	newclaims.push(claim);
	peep.claims = newclaims;
	console.log("addClaim", peep.id+" interimId: "+peep.interimId, claim);
};


/**
 * @deprecated Convenience for getClaim()
 * @param {Object} p
 * @param {?Person} p.person
 * @param {?Person[]} p.persons
 * @param {!String} p.key
 * @param {?String} p.from If set only return claims by this claimant
 * @returns {?String|Number} the "best" claim value or null
 */
const getClaimValue = ({person, persons, key, from}) => {
	let c = getClaim({person,persons,key,from});
	return c? c.v : null;
};


/**
 * @param {Object} p
 * @param {?Person} p.person
 * @param {?Person[]} p.persons
 * @param {!String} p.key
 * @param {?String} p.from If set only return claims by this claimant
 * @returns {?Claim} the "best" claim value or null
 */
const getClaim = ({person, persons, key, from}) => {
	if (person) persons = [person];
	if ( ! persons) return null;
	let claims = getClaims({persons, key});
	// filter by from?
	if (from) {
		claims = claims.filter(c => c.f && c.f.includes(from));
	}
	if ( ! claims.length) return null;
	// HACK pick the best!
	if (claims.length > 1) {
		// prefer the login id
		let myclaims = claims.filter(c => c.f && c.f.length===1 && c.f[0] === Login.getId());
		if (myclaims.length) claims = myclaims;
		// prefer the most recent
		claims.sort(sortByDate(c => c.t));
	}
	return claims[0];
};


/**
 * 
 * @param {Object} p
 * @returns {?PromiseValue} resolves to the "best" Claim value or null
 */
export const getPVClaim = ({xid, key}) => {
	assMatch(key, String, "getPVClaim no key");
	if ( ! xid) xid = Login.getId();
	if ( ! xid) return null;
	let pvPeep = getProfile({xid});
	const pvc = PromiseValue.then(pvPeep, person => {
		const claim = getClaim({person, key});
		return claim;
	});
	// interim?
	if ( ! pvPeep.value && pvPeep.interim) {
		pvc.interim = getClaim({person:pvPeep.interim, key});
	}
	return pvc;
};


/**
 * @param {Object} p
 * @param {?Person} p.person For one profile - why not use `Person.claims()` instead?
 * @param {?Person[]} p.persons
 * @returns {!Claim[]}
 */
const getClaims = ({person, persons, key}) => {
	if (person) persons = [person];
	assMatch(key, String);
	let allClaims = [];
	persons.forEach(peep => allClaims.push(...peep.claims));
	let keyClaims = allClaims.filter(claim => claim.k===key);
	return keyClaims;
};


/**
 * @param {!Person} person 
 * @returns {!Claim[]} the claims for this person (does not look at linked peeps). Do not edit the returned list.
 */
Person.claims = person => person.claims || [];


export {
	doRegisterEmail,
	convertConsents,
	getAllXIds,
	getProfile, getProfileFor,
	getConsents, hasConsent,
	setConsents,
	addConsent, removeConsent,
	saveConsents,
	requestAnalyzeData,
	PURPOSES,
	getEmail,
	// Let's offer some easy ways to edit profile-bundles
	getClaims, getClaimValue, setClaimValue, savePersons, deleteClaim
};
