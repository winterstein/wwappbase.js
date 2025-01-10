'use strict';

// import Enum from 'easy-enums';
// import Roles from './Roles';
import DataStore from './plumbing/DataStore';
import KStatus from './data/KStatus';

const C = {};

/// Apps Should Set These Things :)
/**
 * app config (these settings will likely be overridden and lost)
 * Best practice: Set this in your app.jsx file, from values in a GLAppManifest file.
 */
C.app = 
{
	name: "MyApp",
	/**
	 * id is as used by YouAgain
	 */
	id: window.location.hostname,
	/**
	 * this is the issuer for YouAgain, which can group logins. e.g. "good-loop"
	 */
	dataspace: null,
	logo: "/img/logo.png"
};

// Below here: apps should leave as-is

// easy-enums vs nextjs weird install/compile bug Oct 2024
const Enum = (name, values) => {
    const enumObj = {};
    values.split(' ').forEach(value => {
        enumObj[value] = value;
    });
    enumObj.values = Object.values(enumObj);
    return enumObj;
};

/**
 * This is usually overwritten.
 * Use C.TYPES = new Enum("My Stuff "+C.TYPES.values.join(" ")) to combine
 */
C.TYPES = new Enum("Money User");

/**
 * Special ID for things which dont yet have an ID
 */
C.newId = 'new';

/**
 * hack: local, test, or ''
 * Can be put at the start of our urls
 */
C.SERVER_TYPE = ''; // production
if (window.location.host.startsWith('test')) C.SERVER_TYPE = 'test';
else if (window.location.host.startsWith('local')) C.SERVER_TYPE = 'local';
else if (window.location.host.startsWith('stage')) C.SERVER_TYPE = 'stage';
/** @deprecated OLD HACK: http(s) for when local servers dont have https */
C.HTTPS = (C.SERVER_TYPE === 'local') ? 'https' : 'https'; // migrating towards "just use https" Sep 2023
const prod = C.SERVER_TYPE !== 'local' && C.SERVER_TYPE !== 'test' && C.SERVER_TYPE !== 'stage';
C.isProduction = () => prod;

/**
 * NB: PUBLISHED -> MODIFIED on edit is set by the server (see AppUtils.java doSaveEdit(), or trace usage of KStatus.MODIFIED)
 */
C.KStatus = KStatus;

C.STATUS = new Enum('loading clean dirty saving saveerror'); // 

/**
 * NB: `get` = "get the published version". Editors should explictly request a draft with getDataItem()
 */
C.CRUDACTION = new Enum('new getornew get save copy publish unpublish discardEdits delete archive export');

/**
 * Make "standard" DataStore nodes from C.TYPES
 */
C.setupDataStore = () => {
	let basics = {
		data: {},
		draft: {},
		widget: {},
		list: {},
		misc: {},
		/** about the local environment */
		env: {},
		/** status of server requests, for displaying 'loading' spinners 
		* Normally: transient.$item_id.status
		*/
		transient: {}
	};
	C.TYPES.values.forEach(t => {
		basics.data[t] = {};
		basics.draft[t] = {};
	});
	DataStore.update(basics);
};

export default C;
// also for debug
window.C = C;
