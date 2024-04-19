/**
 * Provides a set of standard functions for managing notifications and other user messages.
 * 
 * Because this is "below" the level of react components, it does not include and UI -- see MessageBar.jsx
 */

import _ from 'lodash';
import DataStore from './DataStore';
import printer from '../utils/printer';

const jsxFromId = {};
const filters = [];

class Msg {
	/**
	 * @type {string} error|warning|info
	 */
	type;
	text;
	id;
	details;
	/**
	 * @type {?String[]|Boolean} TODO only show for this path (e.g. page + slug)
	 */
	path;
	jsx;
}

/**
 @param {Msg} msgOrError
 */
const notifyUser = msgOrError => {
	// defer the call, so that this can be called within a render, and not upset react with nested updates.
	_.defer(() => notifyUser2(msgOrError));
};

const notifyUser2 = (msgOrError) => {
	let msg;
	if (_.isError(msgOrError)) {
		msg = {type:'error', text: msgOrError.message || 'Error'};
	} else if (msgOrError.text) {
		msg = Object.assign({}, msgOrError); // defensive copy
	} else {
		msg = {text: printer.str(msgOrError)};
	}
	let mid = msg.id || printer.str(msg);
	msg.id = mid;
	if (msg.path===true) {
		msg.path = DataStore.getValue(['location','path']);
	}
	// console
	if (msgOrError.type==='error') console.error(msgOrError); else console.log(msgOrError);
	// Never display debug messages to the user
	if (msgOrError.type==='debug') {
		return;
	}
	// Filter the message (default: no filters, allow all)
	// If any filter returns false, don't post the message
	const allow = filters.reduce((acc, filterFn) => (acc && filterFn(msg)), true);
	if ( ! allow) {
		console.log('Messaging.js - message filtered out', msg);
		return;
	}

	let msgs = DataStore.getValue('misc', 'messages-for-user') || {};
	// already there?
	let oldMsg = msgs[mid];
	if (oldMsg && oldMsg.closed) {
		console.log("Messaging.js - skip old closed msg", mid, oldMsg);
		return;
	}
	// NB: if oldMsg is not closed, then it can get updated by replacement by msg

	// HACK allow react to send through custom widgets
	let jsx = msg.jsx;
	if (jsx) {
		// we can't send jsx through the json datastore
		// so stash it here
		delete msg.jsx;
		jsxFromId[msg.id] = jsx;
	}
	// no-op?
	if (oldMsg && JSON.stringify(msg) === JSON.stringify(oldMsg)) {
		return;
	}

	// set
	msgs[mid] = msg; 

	DataStore.setValue(['misc', 'messages-for-user'], msgs, true);
};

/**
 * HACK (or hack-enabler) Add a new filter function, of the form 
 * msgObject (Object) => accept (Boolean)
 * to the list of filters every new message must pass through
 */
const registerFilter = (filterFn) => {
	// Don't re-register existing filters!
	if (filters.find(f => f === filterFn)) return;
	filters.push(filterFn);
}

const Messaging = {
	notifyUser,
	jsxFromId,
	registerFilter,
};
window.Messaging = Messaging;
// HACK wire up DataStore for default Message handling
if ( ! DataStore.Messaging) {
	DataStore.Messaging = Messaging;
}
export {notifyUser};
export default Messaging;
