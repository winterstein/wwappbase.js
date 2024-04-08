
import JSend from '../data/JSend';
import C from '../CBase';
import _ from 'lodash';
import PromiseValue from '../promise-value';

import DataClass, {getId, getType, getStatus} from '../data/DataClass';
import { assert, assMatch } from '../utils/assert';
import {parseHash, toTitleCase, is, space, yessy, getUrlVars, decURI, getObjectValueByPath, setObjectValueByPath, noVal} from '../utils/miscutils';
import KStatus from '../data/KStatus';
import { modifyPage } from './glrouter';


/**
 * Hold data in a simple json tree, and provide some utility methods to update it - and to attach a listener.
 * E.g. in a top-of-the-app React container, you might do `DataStore.addListener((mystate) => this.setState(mystate));`
 */
class Store {
	callbacks = [];

	/** HACK: character to start a local path, "#" or "/" - See glrouter */
	localUrl = '#';

	constructor() {
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
			 * -- location and getUrlValue() are better for navigational focus.
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
			// console.log("DataStore hashchange");
			// NB: avoid a loopy call triggered from setUrlValue()
			// NB: `updating` can be true from other updates ??
			this.parseUrlVars( ! this.updating);
			return true;
		});
		// Should this listen to history popState as well?? Would that replace some calls to parseUrlVars()??
	}


	/**
	 * Keep navigation state in the url, after the hash, so we have shareable urls.
	 * To set a nav variable, use setUrlValue(key, value);
	 * 
	 * Stored as location: { path: String[], params: {key: value} }
	 * @param {?boolean} update Set false to avoid updates (e.g. in a loopy situation)
	 * @param {?string} url (warning: rarely used) Provide the url to parse, instead of window.location.
	 * Use-case: because pushState() is async, so this lets us skip that potential delay.
	 */
	parseUrlVars(update, url) {
		// Is path pre or post hash?
		let {path, params} = this.parseUrlVars2(url);
		// peel off eg publisher/myblog
		let location = {};
		location.path = path;
		let page = path? path[0] : null;
		location.page = page;
		if (path.length > 2) location.slug = path[1];
		if (path.length > 3) location.subslug = path[2];
		location.params = params;
		this.setValue(['location'], location, update);
	}


	parseUrlVars2(url) {
		if (this.localUrl !== '/') {
			return parseHash();
		}
		const params = getUrlVars(url);
		let pathname = window.location.pathname;
		// HACK chop .html
		if (pathname.endsWith(".html")) pathname = pathname.substring(0, pathname.length-5);
		let path = pathname.length ? pathname.split('/').map(decURI) : [];
		// HACK fish out key=value bits
		path = path.filter(bit => {
			if ( ! bit) return false;
			if (bit==="index") { // HACK: /index.html isn't part of the path
				return false;
			}
			let eqi = bit.indexOf("=");
			if (eqi===-1) return true;
			params[bit.substring(0, eqi)] = bit.substring(eqi+1);
			return false;
		});
		return {path, params};
	}


	/**
	 * Set a key=value in the url for navigation. This modifies the window.location and DataStore.appstore.location.params, and does an update.
	 * @param {String} key
	 * @param {String|boolean|number|Date} value
	 * @param {Object} [options] passed to goto()
	 * @returns {String} value
	 */
	setUrlValue(key, value, update, options) {
		assMatch(key, String);
		if (value instanceof Date) {
			value = value.toISOString();
		}
		if (value) assMatch(value, "String|Boolean|Number");
		// the modifyPage hack is in setValue() so that PropControl can use it too
		return this.setValue(['location', 'params', key], value, update, options);
	}


	/**
	 * Get a parameter setting from the url. Convenience for appstate.location.params.key. This is to match setUrlValue.
	 * See also getValue('location','path') for the path.
	 * Use `getValue('location','params')` for all the url parameters
	 * @param {String} key
	 * @returns {String|null|undefined}
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
	 * @returns {boolean} `true` for convenience - can be chained with &&
	 */
	update(newState) {
		// set a flag to detect update loops
		const loopy = this.updating;
		this.updating = true;
		try {
			// merge in the new state
			if (newState) {
				_.merge(this.appstate, newState);
			}
			if (loopy) {
				console.log("DataStore.js update - nested call - deferred", new Error());
				_.defer(() => this.update()); // do the callbacks (again) once we exit the loop
				return;
			}
			// callbacks (e.g. React render) 
			// NB: you may wish to debounce the callback
			this.callbacks.forEach(fn => fn(this.appstate));
		} finally {
			this.updating = false;
		}
		return true; // can be chained with &&
	} // ./update


	/**
	 * Convenience for getting from the data sub-node (as opposed to e.g. focus or misc) of the state tree.
	 * 
	 * Warning: This does NOT load data from the server.
	 * @param statusTypeIdObject -- backwards compatible update to named params
	 * @param {!KStatus} status 
	 * @param type {!C.TYPES}
	 * @param {!String} id 
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
		if (!status || !KStatus.has(status)) status = getStatus(item);
		// end hack

		assert(KStatus.has(status), "DataStore.getData bad status: "+status);
		if ( ! C.TYPES.has(type)) console.warn("DataStore.getData bad type: "+type);
		assert(id, "DataStore.getData - No id?! getData "+type);
		const s = this.nodeForStatus(status);
		let item = this.getValue([s, type, id]);
		return item;
	}


	/**
	 * @param {Object} p
	 * @param {KStatus} p.status
	 * @param {!String} p.type
	 * @param {!Object} p.item
	 * @param {?Boolean} p.update
	 */
	setData(statusTypeItemUpdateObject, item, update = true) {
		assert(statusTypeItemUpdateObject, "setData - no path input?! "+statusTypeItemUpdateObject, item);
		// HACK to allow old code for setData(status, item, update = true) to still work - May 2019
		if (statusTypeItemUpdateObject.item) item = statusTypeItemUpdateObject.item;
		else {
			console.warn("DataStore.setData - old inputs - please upgrade to named {status, item, update}", statusTypeItemUpdateObject, item);
		}
		if (statusTypeItemUpdateObject.update !== undefined) update = statusTypeItemUpdateObject.update;
		// First arg may be status - but check it's valid & if not, fill in status from item object
		let status = statusTypeItemUpdateObject.status || statusTypeItemUpdateObject;
		if (!status || !KStatus.has(status)) status = getStatus(item);
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
		assert(KStatus.has(status), "DataStore.getPath bad status: "+status);
		if ( ! item) {
			return null;
		}
		return this.getDataPath({status, type:getType(item), id:getId(item)});
	}


	/**
	 * the DataStore path for this item, or null if item is null. 
	 * You can pass in an item as all the args (but not if it uses `domain` as a prop!)
	 *  -- But WARNING: editors should always use status DRAFT
	 * @param {Object} p
	 * @param {KStatus} p.status
	 * @param {!C.TYPES} p.type 
	 * @param {!String} p.id 
	 * @param {?String} p.domain Only used by Profiler??
	 * @returns {String[]}
	 */
	getDataPath({status, type, id, domain, ...restOfItem}) {
		if ( ! KStatus.has(status)) {
			console.warn("DataStore.getPath bad status: "+status+" (treat as DRAFT)");
			status=KStatus.DRAFT;
		} 
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
	 * The draft DataStore path for this item, or null if item is null. This is a convenience for `getDataPath(status:DRAFT, type, id)`.
	 * 
	 * NB: It does NOT support `domain` sharded items.
	 * 
	 * @param type {!C.TYPES}
	 * @param id {!String}
	 * @returns {String[]}
	 */
	getDataPathDraft(item) {
		return getDataPath({status:KStatus.DRAFT, type:getType(item), id:getId(item)});
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
		assert(KStatus.has(status), "DataStore bad status: "+status);
		switch(status) {
			case KStatus.PUBLISHED: case KStatus.PUB_OR_ARC: // Hack: locally keep _maybe_archived with published
				return 'data';
			case KStatus.DRAFT: case KStatus.MODIFIED: case KStatus.PENDING: case KStatus.REQUEST_PUBLISH: case KStatus.ARCHIVED:
			case KStatus.PUB_OR_DRAFT: // we can't be ambiguous on where to store
				return 'draft';
			case KStatus.TRASH: return 'trash';
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
		return getObjectValueByPath(this.appstate, path);
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
	 * @param {Boolean} [update] Set to false to switch off sending out an update. Set to true to force an update even if it looks like a no-op.
	 * undefined is true-without-force
	 * @param {Object} [options] goto() options if setting a url parameter
	 * @returns value
	 */
	// TODO handle setValue(pathbit, pathbit, pathbit, value) too
	setValue(path, value, update, options) {
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

		// DEBUG: log data/draft edits
		if (window.DEBUG && (path[0]==='draft' || path[0]==='data')) {
			console.log("DataStore.setValue", path, value, update, new Error("stacktrace"));
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
			// Do not modify browser history -- so this setValue() won't affect (maybe break) browser back button behaviour
			// This might not be what you want all the time - you can override this by setting options.replaceState explitcly
			options = Object.assign({replaceState:true}, options);
			modifyPage(null, newParams, false, false, options);
		}

		// Do the set!
		setObjectValueByPath(this.appstate, path, value);

		// HACK: update a data value => mark it as modified
		// ...but not for setting the whole-object (path.length=3)
		// // (off?) ...or for value=null ??why? It's half likely that won't save, but why ignore it here??
		if ((path[0] === 'data' || path[0] === 'draft')
			&& path.length > 3 && DataStore.DATA_MODIFIED_PROPERTY)
		{
			// chop path down to [data, type, id]
			const itemPath = path.slice(0, 3);
			const item = this.getValue(itemPath);
			if (getType(item) && getId(item)) {
				this.setLocalEditsStatus(getType(item), getId(item), C.STATUS.dirty, false);
			}
		}
		// Tell e.g. React to re-render
		if (update !== false) {
			// console.log("setValue -> update", path, value);
			this.update();
		}
		return value;
	} // ./setValue()


	/**
	 * Convenience for getValue() || setValue(). It's like java's Map.putIfAbsent()
	 * @param {string[]} path 
	 * @param {Object} value Set this IF there is no value already
	 * @param {boolean} [update] Trigger update if the value was set
	 * @returns the value
	 */
	setValueIfAbsent(path, value, update) {
		let v = this.getValue(path);
		if (v) return v;
		return this.setValue(path, value, update);
	}

	/**
	 * Has a data item been modified since loading?
	 * @param {string} type
	 * @param {string} id
	 * @returns {string|null|undefined} "dirty", "clean", etc. -- see C.STATUS
	 */
	getLocalEditsStatus(type, id) {
		assert(C.TYPES.has(type), "DataStore.getLocalEditsStatus "+type);
		assert(id, "DataStore.getLocalEditsStatus: No id?! getData "+type);
		return this.getValue('transient', type, id, DataStore.DATA_MODIFIED_PROPERTY);
	}


	/**
	 * Has a data item been modified since loading?
	 * @param {C.TYPES} type
	 * @param {String} id
	 * @param {C.STATUS} status loading clean dirty saving
	 * @param {boolean} [update] Request a react rerender
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
	 * @param {String[]} path - the full path to the value being edited
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
		// NB: dont trigger a render for this semi-internal state edit
		try {
			this.setValue(['widget', 'modified'].concat(path), flag, false);
		} catch(err) {
			// propcontrols that operate on "complex" json objects can lead to:
			// TypeError: Cannot create property 'country' on boolean 'true'
			// ignore
			console.log("(swallow) PropControl.setModified fail: "+err);
		}
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
	 * Standard path where the timestamp of a fetch() should be stored for caching purposes
	 * @param {String[]} path
	 * @returns {String[]}
	 */
	fetchDatePath(path) {
		return ['transient', 'fetchDate', ...path];
	}


	/**
	 * Time when a fresh fetch() was last performed at this path
	 * @param {String[]} path
	 * @returns {Date}
	 */
	getFetchDate(path) {
		this.getValue(this.fetchDatePath(path));
	}


	/**
	 * Set the time when a fresh fetch() was last performed at this path
	 * @param {String[]} path
	 * @param {Date} [date] Default to now
	 */
	setFetchDate(path, date = new Date()) {
		return this.setValue(this.fetchDatePath(path), date, false);
	}


	/**
	 * Check if a fetch() result is still within its specified cache period
	 * @param {String[]} path
	 * @param {?Number} cachePeriod
	 * @return {boolean}
	 */
	fetchIsFresh(path, cachePeriod) {
		if  (!cachePeriod) return true;
		const fetchDate = this.getFetchDate(path);
		if (!fetchDate) return true; // No timestamp? Either stored without cache-period (always fresh) or never stored (calling code handles this case)
		return fetchDate.getTime() < (new Date().getTime() - cachePeriod);
	}


	/**
	 * Standard path where the PV for a fetch() should be stored for caching purposes
	 * @param {String[]} path
	 * @param {boolean} [refresh] True: alternate path for PVs which will replace a stale cached value when they resolve
	 * @returns {String[]}
	 */
	fetchPVPath(path, refresh) {
		return ['transient', `PromiseValue${refresh ? '-refresh' : ''}`, ...path];
	}


	/**
	 * The stored PromiseValue for a fetch() call
	 * @param {String[]} path
	 * @param {boolean} [refresh] True: get the in-progress PV for a "refresh stale cache" fetch
	 * @returns {?PromiseValue}
	 */
	getFetchPV(path, refresh) {
		let pv = this.getValue(this.fetchPVPath(path, refresh));
		if (pv || refresh) {
			return pv;
		}
		// No PV ...but already in the store?
		// Note: since we retain PVs (to maintain identity i.e. same item always has same PV) 
		// this check is for a corner case (which does happen - e.g. saveAs()),
		// where the datastore has an object that wasn't entered via fetch().
		// For items managed purely by fetch(), we have:
		// - if the item is absent & no fetch in progress, fetch2() will start a fetch & return PV
		// - if the item is absent but fetch in progress, fetch2() will return in-progress PV
		// - if the item is present & fresh (within cache period) fetch2() will return the resolved PV
		// - if the item is present & stale, fetch2() will start a refresh fetch, but return the old PV
		const item = this.getValue(path);
		// Note: falsy or an empty list/object is counted as valid, only null/undefined will trigger a fresh load.
		if (item == null) return null;
		// Make and store a PV that resolves to the item-in-store.
		return this.fetch2(path, () => item);
	}


	/**
	 * Store the PromiseValue associated with a fetch() call
	 * @param {String[]} path
	 * @param {PromiseValue} pv
	 * @param {boolean} [update] True if DataStore should trigger an update after storing
	#* @param {boolean} [refresh] True: store the in-progress PV for a "refresh stale cache" fetch
	 */
	setFetchPV(path, pv, update, refresh) {
		return this.setValue(this.fetchPVPath(path, refresh), pv, update);
	}


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
	 * @param {string[]} path
	 * @param {Function} [fetchFn] () -> Promise/value, which will be wrapped using promise-value.
	 * fetchFn MUST return the value for path, or a promise for it. It should NOT set DataStore itself.
	 * As a convenience hack, this method will use `JSend` to extract `data` or `cargo` from fetchFn's return, so it can be used
	 * that bit more easily with Winterwell's "standard" json api back-end.
	 * If unset, the call will return an in-progress PV, but will not do a fresh fetch.
	 * @param {object} [options]
	 * @param {number} [options.cachePeriod] milliseconds. Normally unset. If set, cache the data for this long - then re-fetch.
	 *  During a re-fetch, the old answer will still be instantly returned for a smooth experience.
	 *  NB: Cache info is stored in `appstate.transient.fetchDate...`
	 *  NB: Cache period clamped to at least 5 seconds, as our code does a lot of redraw churning.
	 * @param {boolean} [options.localStorage]
	 * @param {number} [cachePeriod] Convenience dupe of options.cachePeriod (???)
	 * @returns {PromiseValue} (see promise-value.js)
	 */
	fetch(path, fetchFn, options, cachePeriod) { // TODO allow retry after 10 seconds
		assert(path, 'DataStore.js - missing path:', path);

		if (!options) options = {};
		// backwards compatibility Feb 2021
		if (typeof(options) === 'number') {
			cachePeriod = options;
			options = {};
		}
		if (typeof(options) === 'boolean') options = {};
		if (!typeof(cachePeriod) === 'number') cachePeriod = options.cachePeriod;
		// end backwards compatability

		// HACK Our code churns redraws quite a lot, so a very short cache period will cause hammering.
		if (typeof(cachePeriod) === 'number') {
			cachePeriod = Math.max(cachePeriod, 5000);
		}

		// Only fetch once: has this been fetched before? Is the saved copy fresh?
		const prevPV = this.getFetchPV(path);
		const isFresh = this.fetchIsFresh(path, cachePeriod);
		// Has a previous fetch resolved & found nothing?
		const resolvedToNothing = (prevPV?.resolved && prevPV.value == null);

		// If there's no PV or a failed one...
		let fetchOverridden = false;
		if (resolvedToNothing) {
			const item = this.getValue(path);
			// ...BUT there's an item at the requested path (eg put there by setValue() instead of fetch())
			if ( ! noVal(item)) {
				// Replace fetch function with one which resolves to the item, so calling code gets the item.
				// This will be called below & the result wrapped in a PV, which will be cached appropriately
				fetchFn = () => item;
				fetchOverridden = true;
			}
		}

		// We have an existing PV for this fetch path. Is it OK to return it?
		if (prevPV && !fetchOverridden) {
			if (isFresh) return prevPV; // It's still in cache period - return it.
			if (this.getFetchPV(path, true)) return prevPV; // Refresh already in progress - return old PV in meantime.
			// Stored PV is stale, and refresh NOT already in progress: continue and start a refresh.
			// Poke a marker onto the old PV so calling code can tell it's out-of-date, if it cares.
			prevPV.stale = true;
		}

		// Nothing in store, nothing in-progress, no way to fetch? Return a reject PV.
		if (!fetchFn) return new PromiseValue(null);
		// Cache fail or stale PV - start a fresh fetch.
		const newPV = this.fetch2(path, fetchFn, !isFresh);
		// If this is a refresh fetch, return the old PV (with stale marker).
		// The new one will replace it when it's resolved.
		return prevPV || newPV;
	} // ./fetch()


	/**
	 * Turn whatever object or promise into a PromiseValue. No-op if it's already a PV.
	 * @param {*} thing
	 * @returns {PromiseValue}
	 */
	wrapPV(thing) {
		if (thing instanceof PromiseValue) return thing;
		return new PromiseValue(thing);
	}


	/**
	 * Does the local/remote fetching work for fetch().
	 * Stores PV to cache, but doesn't check for previous PVs!
	 * @param {String[]} path
	 * @param {Function} fetchFn () => promiseOrValue or a PromiseValue. If `fetchFn` is unset (which is unusual), return in-progress or a failed PV.
	 * @param {?boolean} refresh True if this fetch is replacing a stale copy
	 * @returns {!PromiseValue}
	 */
	fetch2(path, fetchFn, refresh) {
		const promiseOrValue = fetchFn();
		assert(promiseOrValue !== undefined, 'fetchFn passed to DataStore.fetch() should return a promise or a value. Got: undefined. Missing return statement?');
		// Ensure fetch result is in a Promise, even if it returned a simple value.
		const fetchPV = this.wrapPV(promiseOrValue);

		// Process the result asynchronously
		const promiseWithCargoUnwrap = fetchPV.promise.then(res => {
			if (!res) return res;
			// HACK handle WW standard json wrapper: unwrap cargo
			// NB: success/fail is checked at the ajax level in ServerIOBase
			// TODO let's make unwrap a configurable setting
			if (JSend.isa(res)) res = JSend.data(res) || res; // HACK: stops login widget forcing rerender on each key stroke
			return res;
		}).catch(response => {
			// what if anything to do here??
			console.warn('DataStore fetch fail', path, response);
			// BV: Typically ServerIO will call notifyUser
			throw response;
		});

		// Wrap this promise as a PV & store right away, so subsequent fetch calls get it back.
		const pv = new PromiseValue(promiseWithCargoUnwrap);
		this.setFetchPV(path, pv, refresh); // Will store to either base or refresh-in-progress path as appropriate

		// When the promise resolves/rejects:
		pv.promise.then(res => {
			// Save result to DataStore at original path
			// Timestamp the response for later freshness checks
			this.setFetchDate(path);

			// Was this a cache-refresh call?
			if (refresh) {
				// Remove the new PV from the "in-progress refresh" path, to clear the
				// way for when the cache expires again & another refresh is needed.
				this.setFetchPV(path, null, false, true);
				// ...and place the new PV at the base path, replacing the old one.
				this.setFetchPV(path, pv, false);
				// No update on either of these calls - setValue() below triggers that.
			}

			// Store result to requested path & trigger view update.
			// This is done after the cargo-unwrap PV has resolved.
			// So any calls to fetch() during render will get a resolved PV even if res is null.
			this.setValue(path, res, true);
			// Bind the PV's value property to the DataStore path (deferred so it finishes resolving itself first)
			// - so later identity-breaking assignments don't cause it to return an inconsistent object.
			const thisDS = this;
			setTimeout(() => {
				delete pv.value;
				Object.defineProperty(pv, 'value', {
					get() { return thisDS.getValue(path); },
					set(v) { throw new Error('Value of a DataStore fetch() PromiseValue is read-only! Fetch path:', path); },
				});
			});
			return res;
		}).catch(res => {
			// Error: leave the failed PV in place to avoid hammering bad API calls...
			console.log(`update re error: ${pv.error} path: ${path}`);
			this.update(); // ...but update React, so components redraw and receive the resolved-but-failed PV.
			throw res;
		});

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
	 * @deprecated
	 */
	getDataList(listOfRefs, preferStatus) {
		console.warn("Switch to resolveDataList");
		return this.resolveDataList(listOfRefs, preferStatus);
	}


	/**
	 * Resolve a list against the data/draft node to get the data items.
	 * @param {Ref[]} listOfRefs
	 * @param {?string} preferStatus e.g. DRAFT to ask for drafts if possible -- which will give you the being-edited items
	 * @returns {Item[]}
	 */
	resolveDataList(listOfRefs, preferStatus) {
		if ( ! listOfRefs) return [];
		// ?? if the data item is missing -- what should go into the list?? null / the ref / a promise ??
		let items = listOfRefs.map(ref => this.resolveRef(ref, preferStatus));
		items = items.filter(i => !!i); // paranoia: no nulls
		return items;
	}


	/**
	 * 
	 * @param {!Ref} ref 
	 * @param {?string} preferStatus
	 * @returns {!Item|Ref} Robust: fallback to the input ref
	 */
	resolveRef(ref, preferStatus) {
		if ( ! ref) {
			return null;
		}
		let status = preferStatus || getStatus(ref);
		const type = getType(ref);
		const id = getId(ref);
		if ( ! (status && type && id)) {
			console.log("(use without resolve if possible) Bad ref in DataStore list - missing status|type|id", ref);
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
class Item extends DataClass {
	status;
	type;
	id;
	name;

	constructor() {
		DataClass._init(this, base);
	}
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


/** When a data or draft item is edited => set a modified flag. Set to falsy if you want to disable this. */
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
 * @param {Object} p
 * @param {KStatus} p.status 
 * @param {!C.TYPES} p.type 
 * @param {!String} p.id 
 * @param {?String} p.domain Only used by Profiler?? 
 * @returns {String[]}
 */
const getDataPath = DataStore.getDataPath.bind(DataStore);


/**
 * DataStore path for a List
 * TODO have a filter-function fot lists, which can dynamically add/remove items
 * @param {Object} p
 * @param {?String} p.q search query
 * @param {?String} sort Optional sort e.g. "created-desc"
 * @returns [list, type, status, domain, query+prefix, period, sort]
 */
const getListPath = ({type, status, q, prefix, start, end, size, sort, domain, ...other}) => {
	// NB: we want fixed length paths, to avoid stored results overlapping with paths fragments.
	return [
		'list', type, status,
		domain || 'nodomain',
		space(q, prefix) || 'all',
		space(start, end) || 'whenever',
		size || '1k',
		yessy(other) ? JSON.stringify(other) : 'normal',
		sort || 'unsorted'
	];
};


/**
 * @param {String[]} path
 */
const getValue = DataStore.getValue.bind(DataStore); 
const setValue = DataStore.setValue.bind(DataStore);

const getUrlValue = DataStore.getUrlValue.bind(DataStore);
const setUrlValue = DataStore.setUrlValue.bind(DataStore);

export {
	getPath,
	getDataPath,
	getListPath,
	getValue, setValue,
	getUrlValue, setUrlValue,
	Ref, Item
};
// accessible to debug
if (typeof(window) !== 'undefined') window.DataStore = DataStore;
