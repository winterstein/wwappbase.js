
import JSend from '../data/JSend';
import C from '../CBase.js';
import _ from 'lodash';
import PromiseValue from 'promise-value';

import {getId, getType, getStatus} from '../data/DataClass';
import {assert,assMatch} from 'sjtest';
import {parseHash, modifyHash, toTitleCase, is, space} from '../utils/miscutils';


/**
 * Hold data in a simple json tree, and provide some utility methods to update it - and to attach a listener.
 * E.g. in a top-of-the-app React container, you might do `DataStore.addListener((mystate) => this.setState(mystate));`
 */
class Store {
	constructor() {
		this.callbacks = [];
		// init the "canonical" categories
		this.appstate = {
			// published data items
			data:{},
			// draft = draft, modified, and pending
			draft:{},
			trash:{},
			/**
			 * What are you looking at?
			 * This is for transient focus. It is NOT for navigation parameters
			 *  -- location and getUrlValue() are better for navigational focus.
			*/
			focus:{},
			/** e.g. form settings */
			widget:{},
			/**
			 * nav state, stored in the url (this gives nice shareable deep-linking urls)
			 */
			location:{},
			/** browser environment */
			env:{},
			misc:{},
			/** YouAgain share info */
			shares:{}
		};
		// init url vars
		this.parseUrlVars();
		// and listen to changes
		window.addEventListener('hashchange', () => {
			// NB: avoid a loopy call triggered from setUrlValue()
			if (this.updating) return true;
			this.parseUrlVars();
			return true;
		});
	}


	/**
	 * Keep navigation state in the url, after the hash, so we have shareable urls.
	 * To set a nav variable, use setUrlValue(key, value);
	 * 
	 * Stored as location: { path: String[], params: {key: value} }
	 */
	parseUrlVars() {
		let {path, params} = parseHash();
		// peel off eg publisher/myblog
		let location = {};
		location.path = path;
		let page = path? path[0] : null;
		location.page = page;
		if (path.length > 2) location.slug = path[1];
		if (path.length > 3) location.subslug = path[2];
		location.params = params;
		this.setValue(['location'], location);
	}


	/**
	 * Set a key=value in the url for navigation. This modifies the window.location and DataStore.appstore.location.params, and does an update.
	 * @param {String} key
	 * @param {String} value
	 */
	setUrlValue(key, value) {
		assMatch(key, String);
		if (value) assMatch(value, "String|Boolean|Number");
		// the modifyHash hack is in setValue() so that Misc.PropControl can use it too
		this.setValue(['location', 'params', key], value);
	}


	/**
	 * Get a parameter setting from the url. Convenience for appstate.location.params.key. This is to match setUrlValue.
	 * See also getValue('location','path') for the path.
	 * @param {String} key
	 */
	getUrlValue(key) {
		assMatch(key, String);
		return this.getValue(['location', 'params', key]);
	}


	/**
	 * It is a good idea to wrap your callback in _.debounce()
	 */
	addListener(callback) {
		this.callbacks.push(callback);
	}


	/**
	 * Update and trigger the on-update callbacks.
	 * @param newState {?Object} This will do an overwrite merge with the existing state.
	 * Note: This means you cannot delete/clear an object using this - use direct modification instead.
	 * Can be null, which still triggers the on-update callbacks.
	 */
	update(newState) {
		// console.log('update', newState);
		// set a flag to detect update loops
		if (this.updating) {
			console.error("DataStore.js update - nested call", new Error());
		}
		this.updating = true;
		try {
			// merge in the new state
			if (newState) {
				_.merge(this.appstate, newState);
			}
			// callbacks (e.g. React render)
			this.callbacks.forEach(fn => fn(this.appstate));
		} finally {
			this.updating = false;
		}
	} // ./update

	/**
	 * Convenience for getting from the data sub-node (as opposed to e.g. focus or misc) of the state tree.
	 * 
	 * Warning: This does NOT load data from the server.
	 * @param statusTypeIdObject -- backwards compatible update to named params
	 * @param status {!C.KStatus}
	 * @param type {!C.TYPES}
	 * @param id {!String}
	 * @returns a "data-item", such as a person or document, or undefined.
	 */
	getData(statusTypeIdObject, type, id) {
		// HACK to allow old code for getData(status, type, id) to still work - May 2019
		if (statusTypeIdObject.type) type = statusTypeIdObject.type;
		else {
			console.warn("DataStore.getData - old inputs - please upgrade to named {status, type, id}", statusTypeIdObject, type, id);
		}
		if (statusTypeIdObject.id) id = statusTypeIdObject.id;
		// First arg may be status - but check it's valid & if not, fill in status from item object
		let status = statusTypeIdObject.status || statusTypeIdObject;
		if (!status || !C.KStatus.has(status)) status = getStatus(item);
		// end hack

		assert(C.KStatus.has(status), "DataStore.getData bad status: "+status);
		assert(C.TYPES.has(type), "DataStore.getData bad type: "+type);
		assert(id, "DataStore.getData - No id?! getData "+type);
		const s = this.nodeForStatus(status);
		let item = this.getValue([s, type, id]);
		return item;
	}


	/**
	 * @param status {?C.KStatus} If unset, use item.status
	 * @param item {!Object}
	 */
	setData(statusTypeIdObject, item, update = true) {
		assert(statusTypeIdObject, "setData - no path input?! "+statusTypeIdObject, item);
		// HACK to allow old code for setData(status, item, update = true) to still work - May 2019
		if (statusTypeIdObject.item) item = statusTypeIdObject.item;
		else {
			console.warn("DataStore.setData - old inputs - please upgrade to named {status, item, update}", statusTypeIdObject, item);
		}
		if (statusTypeIdObject.update !== undefined) update = statusTypeIdObject.update;
		// First arg may be status - but check it's valid & if not, fill in status from item object
		let status = statusTypeIdObject.status || statusTypeIdObject;
		if (!status || !C.KStatus.has(status)) status = getStatus(item);
		// end hack
		
		assert(item && getType(item) && getId(item), item, "DataStore.js setData()");
		assert(C.TYPES.has(getType(item)), item);
		
		const path = this.getPathForItem(status, item);
		this.setValue(path, item, update);
	}


	/**
	 * the DataStore path for this item, or null if item is null;
	 */
	getPathForItem(status, item) {
		if ( ! status) status = getStatus(item);
		assert(C.KStatus.has(status), "DataStore.getPath bad status: "+status);
		if ( ! item) {
			return null;
		}
		return this.getDataPath({status, type:getType(item), id:getId(item)});
	}


	/**
	 * the DataStore path for this item, or null if item is null. 
	 * You can pass in an item as all the args (but not if it uses `domain` as a prop!)
	 *  -- But WARNING: editors should always use status DRAFT
	 * @param status {C.KStatus}
	 * @param type {!C.TYPES}
	 * @param id {!String}
	 * @param domain {?String} Only used by Profiler??
	 * @returns {String[]}
	 */
	getDataPath({status, type, id, domain, ...restOfItem}) {
		assert(C.KStatus.has(status), "DataStore.getPath bad status: "+status);
		if ( ! type) type = getType(restOfItem);
		assert(C.TYPES.has(type), "DataStore.js bad type: "+type);
		assMatch(id, String, "DataStore.js bad id "+id);
		const s = this.nodeForStatus(status);
		if (domain) {
			return [s, domain, type, id];
		} else {
			return [s, type, id];
		}
	}


	/**
	 * @deprecated switch to getDataPath()
	 * the DataStore path for this item, or null if item is null;
	 */
	getPath(status, type, id, domain) {
		console.warn("DataStore.getPath() - Please switch to getDataPath({status, type, id, domain})", status, type, id, domain);
		return this.getDataPath({status, type, id, domain});
	}


	/**
	 * @returns {String} the appstate.X node for storing data items of this status.
	 */
	nodeForStatus(status) {
		assert(C.KStatus.has(status), "DataStore bad status: "+status);
		switch(status) {
			case C.KStatus.PUBLISHED: return 'data';
			case C.KStatus.DRAFT: case C.KStatus.MODIFIED: case C.KStatus.PENDING: case C.KStatus.REQUEST_PUBLISH: case C.KStatus.ARCHIVED:
				return 'draft';
			case C.KStatus.TRASH: return 'trash';
		}
		throw new Error("DataStore - odd status "+status);
	}


	getValue(...path) {
		assert(_.isArray(path), "DataStore.getValue - "+path);
		// If a path array was passed in, use it correctly.
		if (path.length===1 && _.isArray(path[0])) {
			path = path[0];
		}
		assert(this.appstate[path[0]],
			"DataStore.getValue: "+path[0]+" is not a json element in appstate - As a safety check against errors, the root element must already exist to use getValue()");
		let tip = this.appstate;
		for(let pi=0; pi < path.length; pi++) {
			let pkey = path[pi];
			assert(pkey || pkey===0, "DataStore.getValue: "+path); // no falsy in a path - except that 0 is a valid key
			let newTip = tip[pkey];
			// Test for hard null -- falsy are valid values
			if (newTip===null || newTip===undefined) return null;
			tip = newTip;
		}
		return tip;
	}


	/**
	 * Update a single path=value.
	 * 
	 * Unlike update(), this can set {} or null values.
	 * 
	 * It also has a hack, where edits to [data, type, id, ...] (i.e. edits to data items) will
	 * also set the modified flag, [transient, type, id, localStatus] = dirty.
	 * This is a total hack, but handy.
	 * 
	 * @param {String[]} path This path will be created if it doesn't exist (except if value===null)
	 * @param {*} value The new value. Can be null to null-out a value.
	 * @param {boolean} update Set to false to switch off sending out an update. Set to true to force an update even if it looks like a no-op.
	 * undefined is true-without-force
	 * @returns value
	 */
	// TODO handle setValue(pathbit, pathbit, pathbit, value) too
	setValue(path, value, update) {
		assert(_.isArray(path), "DataStore.setValue: "+path+" is not an array.");
		assert(this.appstate[path[0]],
			"DataStore.setValue: "+path[0]+" is not a node in appstate - As a safety check against errors, the root node must already exist to use setValue()");
		// console.log('DataStore.setValue', path, value);
		const oldVal = this.getValue(path);
		if (oldVal === value && update !== true && ! _.isObject(value)) {
			// The no-op test only considers String and Number 'cos in place edits of objects are common and would cause problems here.
			// console.log("setValue no-op", path, value, "NB: beware of in-place edits - use update=true to force an update");
			return oldVal;
		}

		// HACK: modify the url?
		if (path[0] === 'location' && path[1] === 'params') {
			let newParams;
			assert(path.length === 3 || (path.length===2 && _.isObject(value)), "DataStore.js - path should be location.params.key was: "+path);
			if (path.length==3) {
				newParams = {};
				newParams[path[2]] = value;
			} else {
				newParams = value;
			}
			modifyHash(null, newParams);
		}

		let tip = this.appstate;
		for(let pi=0; pi < path.length; pi++) {
			let pkey = path[pi];
			if (pi === path.length-1) {
				// Set it!
				tip[pkey] = value;
				break;
			}
			assert(pkey || pkey===0, "falsy in path "+path.join(" -> ")); // no falsy in a path - except that 0 is a valid key
			let newTip = tip[pkey];
			if ( ! newTip) {
				if (value===null) {
					// don't make path for null values
					return value;
				}
				newTip = tip[pkey] = {};
			}
			tip = newTip;
		}
		// HACK: update a data value => mark it as modified (but not for deletes)
		if (is(oldVal) && is(value) && (path[0] === 'data' || path[0] === 'draft')
			&& path.length > 2 && DataStore.DATA_MODIFIED_PROPERTY)
		{
			// chop path down to [data, type, id]
			const itemPath = path.slice(0, 3);
			const item = this.getValue(itemPath);
			if (getType(item) && getId(item)) {
				this.setLocalEditsStatus(getType(item), getId(item), C.STATUS.dirty, false);
			}
		}
		if (update !== false) {
			// console.log("setValue -> update", path, value);
			this.update();
		}
		return value;
	} // ./setValue()


	/**
	 * Has a data item been modified since loading?
	 * @param {*} type
	 * @param {*} id
	 * @return "dirty", "clean", etc. -- see C.STATUS
	 */
	getLocalEditsStatus(type, id) {
		assert(C.TYPES.has(type), "DataStore.getLocalEditsStatus "+type);
		assert(id, "DataStore.getLocalEditsStatus: No id?! getData "+type);
		return this.getValue('transient', type, id, DataStore.DATA_MODIFIED_PROPERTY);
	}


	/**
	 * Has a data item been modified since loading?
	 * @param {C.TYPES} type
	 * @param {!String} id
	 * @param {C.STATUS} status loading clean dirty saving
	 * @return "dirty", "clean", etc. -- see C.STATUS
	 */
	setLocalEditsStatus(type, id, status, update) {
		assert(C.TYPES.has(type));
		assert(C.STATUS.has(status));
		assert(id, "DataStore.setLocalEditsStatus: No id?! getData "+type);
		if ( ! DataStore.DATA_MODIFIED_PROPERTY) return null;
		return this.setValue(['transient', type, id, DataStore.DATA_MODIFIED_PROPERTY], status, update);
	}


	/**
	 * @param {!String[]} path - the full path to the value being edited
	 * @returns {boolean} true if this path has been modified by a user-edit to a PropControl
	 */
	isModified(path) {
		const mpath = ['widget', 'modified'].concat(path);
		return this.getValue(mpath);
	}


	/**
	 * Has a path in DataStore been modified by the user? This is auto-set by PropControl -- NOT by DataStore.
	 * So if you use this with non-PropControl edits -- you must call it yourself.
	 * 
	 * Use-case: for business-logic that sets default values, so it can tell whether or not the user has made an edit.
	 * 
	 * @param {!String[]} path - the full path to the value being edited
	 * @param {?boolean} flag Defaults to true
	 * @see #setLocalEditsStatus() which is for ajax state
	 */
	setModified(path, flag=true) {
		// NB: dont trigger a render for this emi-internal state edit
		this.setValue(['widget', 'modified'].concat(path), flag, false);
	}


	/**
	* Set widget.thing.show
	 * @param {String} thing The name of the widget.
	 * @param {Boolean} showing
	 */
	setShow(thing, showing) {
		assMatch(thing, String);
		this.setValue(['widget', thing, 'show'], showing);
	}


	/**
	 * Convenience for widget.thing.show
	 * @param {String} widgetName
	 * @returns {boolean} true if widget is set to show
	 */
	getShow(widgetName) {
		assMatch(widgetName, String);
		return this.getValue('widget', widgetName, 'show');
	}


	/**
	* Set focus.type Largely @deprecated by url-values (which give deep-linking)
	* @param {!C.TYPES} type
	 * @param {?String} id
	 */
	setFocus(type, id) {
		assert(C.TYPES.has(type), "DataStore.setFocus");
		assert( ! id || _.isString(id), "DataStore.setFocus: "+id);
		this.setValue(['focus', type], id);
	}


	/**
	 * Largely @deprecated by url-values (which give deep-linking)
	 */
	getFocus(type) {
		assert(C.TYPES.has(type), "DataStore.getFocus");
		return this.getValue('focus', type);
	}


	/**
	 * Get hits from the cargo, and store them under data.type.id
	 * @param {*} res
	 * @returns {Item[]} hits, can be empty
	 */
	updateFromServer(res, status) {
		console.log("updateFromServer", res);
		// must be bound to the store
		assert(this && this.appstate, "DataStore.updateFromServer: Use with .bind(DataStore)");
		let hits = res.hits || (JSend.data(res) && JSend.data(res).hits); // unwrap cargo
		if ( ! hits && JSend.isa(res) && JSend.data(res)) {
			hits = [JSend.data(res)]; // just the one?
		}
		if ( ! hits) return [];
		hits.forEach(item => {
			try {
				const type = getType(item);
				if ( ! type) {
					console.log("skip server object w/o type", item);
					return;
				}
				assert(C.TYPES.has(type), "DataStore.updateFromServer: bad type:" + type, item);
				const s = status || getStatus(item);
				assert(s, "DataStore.updateFromServer: no status in method call or item", item);
				const statusPath = this.nodeForStatus(s);
				const id = getId(item);
				assert(id, 'DataStore.updateFromServer: no id for', item, 'from', res);
				// Put the new item in the store, but don't trigger an update until all items are in.
				this.setValue([statusPath, type, id], item, false);
				// mark it as clean 'cos the setValue() above might have marked it dirty
				this.setLocalEditsStatus(type, id, C.STATUS.clean, false);
			} catch(err) {
				// swallow and carry on
				console.error(err);
			}
		});
		// OK, now trigger a redraw.
		this.update();
		return hits;
	} //./updateFromServer()


	/**
	 * get local, or fetch by calling fetchFn (but only once).
	 * Does not call update here and now, so it can be used inside a React render().
	 * 
	 * Warning: This will not modify appstate except for the path given, and transient.
	 * So if you fetch a list of data items, they will not be stored into appstate.data.
	 * The calling method should do this.
	 * NB: an advantage of this is that the server can return partial data (e.g. search results)
	 * without over-writing the fuller data.
	 * 
	 * @param {String[]} path
	 * @param {Function} fetchFn () -> Promise/value, which will be wrapped using promise-value.
	 * fetchFn MUST return the value for path, or a promise for it. It should NOT set DataStore itself.
	 * As a convenience hack, this method will use `JSend` to extract `data` or `cargo` from fetchFn's return, so it can be used
	 * that bit more easily with Winterwell's "standard" json api back-end.
	 * If unset, the call will return an inprogress PV, but will not do a fresh fetch.
	 * @param {?Boolean} messaging If true (the default), try to use Messaging.js to notify the user of failures.
	 * @param {?Number} cachePeriod milliseconds. Normally unset. If set, cache the data for this long - then re-fetch.
	 * 	During a re-fetch, the old answer will still be instantly returned for a smooth experience.
	 * 	NB: Cache info is stored in `appstate.transient.fetchDate...`
	 * @returns {!PromiseValue} (see promise-value.js)
	 */
	fetch(path, fetchFn, messaging=true, cachePeriod) { // TODO allow retry after 10 seconds
		assert(path, "DataStore.js - missing input",path);
		// in the store?
		let item = this.getValue(path);
		if (item!==null && item!==undefined) {
			// out of date?
			if (cachePeriod) {
				const now = new Date();
				const epath = ['transient', 'fetchDate'].concat(path);
				let fetchDate = this.getValue(epath);
				if ( ! fetchDate || fetchDate.getTime() < now.getTime() - cachePeriod) {
					// fetch a fresh copy
					console.log("DataStore", "stale - fetch fresh", path);
					const pv = this.fetch2(path, fetchFn, cachePeriod);
					// ...but (unless fetchFn returned instantly - which is unusual) carry on to return the cached value instantly
					if (pv.resolved) return pv;
				}
			}
			// Note: falsy or an empty list/object is counted as valid. It will not trigger a fresh load
			return new PromiseValue(item);
		}
		// Fetch it
		return this.fetch2(path, fetchFn, cachePeriod);
	} // ./fetch()


	/**
	 * Does the remote fetching work for fetch()
	 * @param {String[]} path
	 * @param {Function} fetchFn If unset (which is unusual), return in-progress or a failed PV
	 * @param {?Boolean} messaging
	 * @param {?Number} cachePeriod
	 * @returns {!PromiseValue}
	 */
	fetch2(path, fetchFn, cachePeriod) {
		// only ask once
		const fpath = ['transient', 'PromiseValue'].concat(path);
		const prevpv = this.getValue(fpath);
		if (prevpv) return prevpv;
		if ( ! fetchFn) {
			return new PromiseValue(null); // nothing in-progress, so return a reject PV
		}
		let promiseOrValue = fetchFn();
		assert(promiseOrValue!==undefined, "fetchFn passed to DataStore.fetch() should return a promise or a value. Got: undefined. Missing return statement?");
		// Use PV to standardise the output from fetchFn()
		let pvPromiseOrValue = new PromiseValue(promiseOrValue);
		// pvPromiseOrValue.name = "pvPromiseOrValue_"+JSON.stringify(path); // DEBUG HACK
		// process the result async
		let promiseWithCargoUnwrap = pvPromiseOrValue.promise.then(res => {
			if ( ! res) return res;
			// HACK handle WW standard json wrapper: unwrap cargo
			// NB: success/fail is checked at the ajax level in in ServerIOBase
			// TODO let's make unwrap a configurable setting
			if (JSend.isa(res)) {
				console.log("unwrapping cargo to store at "+path, res);
				res = JSend.data(res) || res; // HACK: stops login widget forcing rerender on each key stroke
			}
			return res;
		}).catch(response => {
			// what if anything to do here??
			console.warn("DataStore fetch fail", path, response);
			// BV: Typically ServerIO will call notifyUser
			throw response;
		});
		// wrap this promise as a PV
		const pv = new PromiseValue(promiseWithCargoUnwrap);
		// pv.name = "pv_"+JSON.stringify(path); // DEBUG HACK
		pv.promise.then(res => {
			// set the DataStore
			// cache-period? then store the fetch time
			if (cachePeriod) {
				const epath = ['transient', 'fetchDate'].concat(path);
				this.setValue(epath, new Date(), false);
			}
			// This is done after the cargo-unwrap PV has resolved. So any calls to fetch() during render will get a resolved PV
			// even if res is null.
			this.setValue(path, res); // this should trigger an update (typically a React render update)
			// finally, clear the promise from DataStore
			this.setValue(fpath, null, false);
			return res;
		}).catch(res => {
			// keep the fpath promise to avoid repeated ajax calls??
			// update e.g. React
			this.update();
			throw res;
		});
		this.setValue(fpath, pv, false);
		return pv;
	} // ./fetch2()


	/**
	 * Remove any list(s) stored under ['list', type].
	 * 
	 * These lists are often cached results from the server - this method is called to invalidate the cache
	 * (and probably force a reload via other application-level code).
	 * 
	 * If more fine-grained control is provided, just call `setValue(['list', blah], null);` directly.
	 */
	invalidateList(type) {
		assMatch(type, String);
		const listWas = this.getValue(['list', type]);
		if (listWas) {
			this.setValue(['list', type], null);
			console.log('publish -> invalidate list', type, listWas);
		} else {
			console.log('publish -> no lists to invalidate');
		}
		// also remove any promises for these lists -- see fetch()
		let ppath = ['transient', 'PromiseValue', 'list', type];
		this.setValue(ppath, null, false);
	}


	/**
	 * Resolve a list against the data/draft node to get the data items.
	 * @param {Ref[]} listOfRefs
	 * @param {?string} preferStatus e.g. DRAFT to ask for drafts if possible -- which will give you the being-edited items
	 * @returns {Item[]}
	 */
	getDataList(listOfRefs, preferStatus) {
		if ( ! listOfRefs) return [];
		// ?? if the data item is missing -- what should go into the list?? null / the ref / a promise ??
		let items = listOfRefs.map(ref => this.resolveRef(ref));
		items = items.filter(i => !!i); // paranoia: no nulls
		return items;
	}

	/**
	 * 
	 * @param {!Ref} ref 
	 * @param {?string} preferStatus
	 * @returns {!Item|Ref}
	 */
	resolveRef(ref, preferStatus) {
		if ( ! ref) {
			return null;
		}
		let status = preferStatus || getStatus(ref);
		const type = getType(ref);
		const id = getId(ref);
		if ( ! (status && type && id)) {
			console.warn("(use without resolve) Bad ref in DataStore list", ref);
			return ref;
		}
		let item = this.getData({status,type,id});
		if (item) return item;
		if (preferStatus) {
			// try again?
			status = getStatus(ref);
			if (status && status !== preferStatus) {
				item = this.getData({status,type,id});
				if (item) return item;
			}
		}
		// falback to the input ref
		return ref;
	}
} // ./Store

class Ref {
	status;
	type;
	id;
}
/**
 * Item could be anything - Advert, NGO, Person.
 * This class is to help in defining the DataStore API -- not for actual use.
 */
class Item {
	status;
	type;
	id;
	name;
}

const DataStore = new Store();
// create some of the common data nodes
DataStore.update({
	transient: {},
	data: {},
	draft: {},
	/**
	 * Use this for widget state info which the outside app can inspect.
	 * For purely internal state, use React's `useState()` instead.
	 * 
	 * E.g. see PropControl's modified flag
	 */
	widget: {},
	/**
	 * list should be: type (e.g. Advert) -> list-id (e.g. 'all' or 'q=foo') -> List
	 * Where List is {hits: refs[], total: Number}
	 * refs are {id, type, status}
	 * see List.js
	 * 
	 * And store the actual data objects in the data/draft node.
	 * 
	 * This way list displays always access up-to-date data.
	 */
	list: {}
});
// switch on data item edits => modified flag
DataStore.DATA_MODIFIED_PROPERTY = 'localStatus';
export default DataStore;

// provide getPath as a convenient export
// TODO move towards offering functions cos VS auto-complete seems to work better
/**
 * the DataStore path for this item, or null if item is null;
 * @param status WARNING - If you are editing, you need status=Draft!
 * @param type
 * @param id
 */
const getPath = DataStore.getPath.bind(DataStore);

/**
 * the DataStore path for this item, or null if item is null. 
 * You can pass in an item as all the args (but not if it uses `domain` as a prop!)
 *  -- But WARNING: editors should always use status DRAFT
 * @param status {C.KStatus}
 * @param type {!C.TYPES}
 * @param id {!String}
 * @param domain {?String} Only used by Profiler??
 * @returns {String[]}
 */
const getDataPath = DataStore.getDataPath.bind(DataStore);


/**
 * DataStore path for list
 *  * 	// TODO have a filter-function fot lists, which can dynamically add/remove items
 * @param {?String} sort Optional sort e.g. "created-desc"
 * @returns [list, type, status, domain, query+prefix, sort]
 */
const getListPath = ({type,status,q,prefix,sort,domain}) => {
	// NB: we want fixed length paths, to avoid stored results overlapping with paths fragments.
	return ['list', type, status, 
		domain || 'nodomain', 
		space(q, prefix) || 'all', 
		sort || 'unsorted'];
};

/**
 * @param {String[]} path
 */
const getValue = DataStore.getValue.bind(DataStore); const setValue = DataStore.setValue.bind(DataStore);
export {
	getPath,
	getDataPath,
	getListPath,
	getValue, setValue
};
// accessible to debug
if (typeof(window) !== 'undefined') window.DataStore = DataStore;
