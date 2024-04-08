/**
 * Provide the data management for ShareWidget
 */
import Login from '../base/youagain';
import DataStore from './plumbing/DataStore';
import {assMatch } from './utils/assert';
import PromiseValue from './promise-value';
import C from './CBase';
import DataClass from './data/DataClass';
/**
 * @typedef {string} XId
 */

/**
 * See DBShare.java
 */
class Share extends DataClass {
	/** @type {String} see shareThingId() */
	item;
	/** @type {XId} */
	by;
	/** @type {XId} */
	_to;

	constructor(base) {
		super(base);
		Object.assign(this, base);
	}
}
DataClass.register(Share, "Share");

/*	DataStore structure:
shares.{shareId}.list.hits
shares.{shareId}.check
*/
const pathToListHits = shareId => ['shares', shareId, 'list', 'hits'];

const CACHE_TIME_MS = 30*1000; // 30 seconds;

/**
 * Namespaces data item IDs for sharing
 * @param {!String} type e.g. Publisher
 * @param {!String} id the item's ID
 * @returns {String} the thingId to be used with Login.share functions
 */
const shareThingId = (type, id) => {
	C.TYPES.assert(type, "shareThingId() "+id);
	assMatch(id, String);
	if (id.startsWith(type+":")) {
		console.error("shareThingId() nested id?! "+id+" type: "+type);
	}
	return type+":"+id;
};

/**
 * List the shares for an object (the user must have access to the thing).
 * 
 * @param {!String} shareId 
 * @returns {PromiseValue} PV<Share[]>
 */
const getShareListPV = shareId => {
	return DataStore.fetch(pathToListHits(shareId), 
		() => Login.getShareList(shareId),
		false, CACHE_TIME_MS);
};

const claimItem = ({type, id}) => {
	C.TYPES.assert(type);
	assMatch(id,String);
	// ??how does this modify the datastore??
	return Login.claim(shareThingId(type, id))
		.then(DataStore.update);
}

/**
 * ?? read vs write ??
 * @param {Object} p
 * @param {!string} p.shareId
 * @param {!XId} p.withXId
 * @returns {Promise} Login.shareThing
 */
const doShareThing = ({shareId, withXId}) => {
	// call the server
	let p = Login.shareThing(shareId, withXId);
	// optimistically update the local list
	const spath = pathToListHits(shareId);
	let shares = DataStore.getValue(spath) || [];
	shares = shares.concat({
		item: shareId,
		by: Login.getId(),
		_to: withXId 
	});
	DataStore.setValue(spath, shares);
	return p;
}

/**
 * 
 * @param {Share} share 
 */
const doDeleteShare = share => {
	let shareId = share.item;
	let p = Login.deleteShare(shareId, share._to);
	// optimistically update the local list
	const spath = pathToListHits(shareId);
	let shares = DataStore.getValue(spath);
	if ( ! shares) return p;
	shares = shares.filter(s => s !== share);
	DataStore.setValue(spath, shares);
	return p;
};

/**
 * 
 * @returns {PromiseValue<Boolean>} .value resolves to true if they can read
 */
const canRead = (type, id) => canDo(type, id, 'read');

/**
 * 
 * @returns {PromiseValue<Boolean>} .value resolves to true if they can read
 */
const canWrite = (type, id) => canDo(type, id, 'write');

/**
 * 
 * @param {*} type 
 * @param {*} id 
 * @param {String} rw "read"|"write"
 */
const canDo = (type, id, rw) => {
	C.TYPES.assert(type);
	assMatch(id, String);
	let sid = shareThingId(type, id);
	return DataStore.fetch(['shares', sid, 'check', rw], () => {
		return Login.checkShare(sid)
			.then(res => {
				let yes = !! (res.cargo && res.cargo[rw]); // force boolean not falsy, as undefined causes DataStore.fetch to repeat
				if (yes) return yes;
				// superuser powers? NB: this does need Roles to be pre-loaded by some other call for it to work.					
				if (C.CAN.sudo) {
					// sudo?
					yes = Roles.iCan(C.CAN.sudo).value;
				}
				return yes;
			});
		}, 
		{
			cachePeriod: CACHE_TIME_MS // allow for permissions to change e.g. "Let me share that with you..."
		}
	);	 // ./fetch
};


const Shares = {
	shareThingId,
	canRead, canWrite,
	getShareListPV,
	doShareThing,
	claimItem,
	doDeleteShare
};
window.Shares = Shares; // debug hack

export default Shares;
export {
	Share,
	shareThingId,
	canRead, canWrite,
	getShareListPV,
	doShareThing,
	claimItem, 
	doDeleteShare
};
