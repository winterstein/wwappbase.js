/**
*/

import _ from 'lodash';
import { assert, assMatch } from '../utils/assert';
import printer from '../utils/printer';

/*

DataClass helps avoid the serialisation / deserialisation pain when working with classes and json.
It does this by using static methods, which take the object as their first input.
This gives you an object-oriented coding style (including inheritance) -- which can work with plain-old-js-objects.
 * 
 * These files are all about defining a convention, so please follow the rules below.

 */


/**
 * Standard use
```
import DataClass, {getType} from './DataClass';
import C from './C';
class MyType extends DataClass {

};
DataClass.register(MyType, "MyType");
// or
class MyType extends ParentType {
	constructor(base) {
		super();
		DataClass._init(this, base);
	}
}

const This = MyType;
export default MyType;
```

...custom functions

 */
class DataClass {

	/**
	 * Sub-classes with properties/fields MUST define a constructor that calls `DataClass._init()` or has the line:
	 * Object.assign(this, base);
	 * For example:
	 * ```
	constructor(base) {
		super();
		DataClass._init(this, base);
	}
	```
	 
	* Why? Otherwise IF your class defines any property values, then
	 * these take precedence over anything this super constructor does.
	 * So data from `base` would easily be lost.
	 */
	constructor(base) {		
		DataClass._init(this, base);
	}

	static _init(item, base) {
		Object.assign(item, base); // Better done in subclass!
		item['@type'] = item.constructor._name || item.constructor.name;	
		// Avoid e.g. copying a Published object and setting the status to Published
		delete item.status; // Better done in subclass!
	}

	/**
	 * check the type!
	 */
	static isa(obj) {
		if ( ! _.isObject(obj) || _.isArray(obj)) return false;
		// console.warn(this, this.name);
		const typ = this;
		const sotyp = getType(obj);
		if ( ! sotyp) return false;
		// NB: the .name test can fail 'cos production Babel renames classes. Also its redundant if register() was called. But just to be safe.
		if (sotyp === typ._name || sotyp === typ.name) return true;
		const otyp = getClass(sotyp);
		return isa2(otyp, typ);
	}

	/**
	 * @param {!DataClass} obj 
	 * @param {?string} msg 
	 * @returns {boolean} true
	 */
	static assIsa(obj, msg) {
		assert(this.isa(obj), (msg||'')+" "+this.name+" expected, but got ", obj);
		return true;
	}

	/**
	 * Like assIsa(), but only throws an error if the type is set and wrong. So duck-typing is fine.
	 * Use-case: a cautious type check. Prefer assIsa() when possible.
	 * 
	 * @param {!Object} obj 
	 * @param {?string} msg 
	 */
	static checkIsa(obj, msg) {
		if (this.isa(obj)) return true;
		const typ = this;
		const sotyp = getType(obj);
		if (sotyp && this._name && sotyp !== this._name) {
			throw new Error("Wrong class: "+(msg||'')+" "+this._name+" expected, but got "+sotyp+" from "+JSON.stringify(obj));
		}
		return null; // dunno
	}

	/**
	* @param {?Object} obj
	* @returns {?String} An instance name, e.g. "Daniel" NOT the class name
	*
	* Note: Not all classes or instance have a name. This function is defined here as it is
	* a bit of a special case. Instances can have their own names. But you cant reassign the 
	* builtin class property `MyClass.name` = the class name, so we can't follow the fluent naming 
	* convention of X.f(x) => x.f. Hence why this is called getName(). And defined here so we 
	* can explain that once.
	*/
	static getName(obj) {
		return obj? obj.name : null;
	}	

	/**
	 * Initialise a list to []. Remove any falsy values (updating item if there were any).
	 * NB: handles a bug seen in SoGive, Jan 2020
	 * @param {!Object} item 
	 * @param {!string} fieldName 
	 * @returns {!Object[]} item.fieldName, can be empty, never null
	 */
	static safeList(item, fieldName)	{
		let list = item[fieldName];
		if ( ! list) {
			item[fieldName] = [];
			return item[fieldName];
		}
		// remove any nulls / falsy (bug seen in SoGive Jan 2020)
		if (list.findIndex(x => ! x) !== -1) {
			list = list.filter(x => x);
			item[fieldName] = list;
		}
		return list;
	}


	toString() {
		const klass = getClass(this);
		if (klass && klass.str) return klass.str(this);
		return "["+getType(this)+" "+(getId(this)||"")+"]";
	}

} // ./DataClass


/**
 * @param otyp {!DataClass}
 * @param typ {!DataClass}
 */
const isa2 = (otyp, typ) => {
	if ( ! otyp) return false;
	// console.warn(typ.prototype, typ.__proto__, otyp.prototype, otyp.__proto)
	if (otyp === typ) return true;
	// sub-type?
	return isa2(otyp.__proto__, typ);
};
window.isa2 = isa2; // debug

/**
 * Uses schema.org or gson class to get the type.
 * Or null
 * @param {?any} item
 * @returns {?String} e.g. "Money"
 * 
 * See also getClass()
 */
const getType = function(item) {
	if ( ! item) return null;
	// schema.org type?
	let type = item['@type'];
	if (type) return type;
	// Java class from FlexiGson?
	let klass = item['@class'];
	if (klass) {
		type = klass.substr(klass.lastIndexOf('.')+1);
		return type;
	}
	// .type? or undefined
	return item.type;
};

/**
 * Prefers a plain .id but also supports schema.org @id and WW's xid.
 * null returns null
 * @returns {String}
 */
const getId = (item) => {
	if ( ! item) return null;
	assert(typeof(item)==="object", "Not a DataItem",typeof(item),item);
	if (item.id && item['@id'] && item.id !== item['@id']) {
		console.warn("conflicting id/@id item ids "+item.id+" vs "+item['@id'], item);
	}
	const id = item.id || item['@id'] || item.xid;
	if ( ! id) { // sanity check that the user hasnt passed a promise or promise-value
		assert( ! item.then, "Passed a promise to getId()");
		assert( ! item.promise, "Passed a promise-value to getId()");
	}
	// e.g. Person has an array of IDs
	if (_.isArray(id)) {
		return id[0]; // HACK: use the first
	}
	return id;
};
DataClass.id = getId;

/**
 * @param item {?DataItem} null returns null
 * @returns {C.KStatus} DRAFT / PUBLISHED
 */
const getStatus = (item) => {
	if ( ! item) return null;
	const s = item.status;
	if ( ! s) return null;
	assert(C.KStatus.has(s), "DataClass.js getStatus", item);
	return s;
};
DataClass.status = getStatus;

/**
 * TODO move into SoGive
 * access functions for source, help, notes??
 */
const Meta = {};

/** {notes, source} if set
 * Never null (may create an empty map). Do NOT edit the returned value! */
// If foo is an object and bar is a primitive node, then foo.bar has meta info stored at foo.meta.bar
Meta.get = (obj, fieldName) => {
	if ( ! fieldName) {
		return obj.meta || {};
	}
	let fv = obj[fieldName];
	if (fv && fv.meta) return fv.meta;
	if (obj.meta && obj.meta[fieldName]) {
		return obj.meta[fieldName];
	}
	// nope
	return {};
};

/**
 * nonce vs uid? nonce is shorter (which is nice) and it avoids -s (which upset ES searches if type!=keyword)
 * @param {?Number} n Defaults to 10, which is safe for most purposes
 * @returns random url-safe nonce of the requested length.
 * 
 * Let's see:
 * 60^6 ~ 50 bn
 * But the birthday paradox gives n^2 pairings, so consider n^2 for likelihood of a clash.
 * For n = 1000 items, this is safe. For n = 1m items, 6 chars isn't enough - add a timestamp to avoid the all-to-all pairings.
 */
const nonce = (n=10) => {
	const s = [];
	// letters for clarity or randomness?
	const az = n < 7? "23456789abcdefghijkmnpqrstuvwxyz" // lowercase and no o01l for safer transmission
		: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	for (let i = 0; i < n; i++) {
		s[i] = az.substr(Math.floor(Math.random() * az.length), 1);
	}
	return s.join("");
};

// NB: cannot assign DataClass.name as that is a reserved field name for classes
DataClass.title = obj => obj && (obj.title || DataClass.getName(obj.name));
/**
 * General purpose to-string
 * @param {*} obj 
 * @param {?boolean} _abandonLoop for internal use to help avoid loops
 */
DataClass.str = (obj, _abandonLoop) => {
	if ( ! obj) return '';
	let k = getClass(obj);
	if (k && k.str && ! _abandonLoop) {
		return k.str(obj, true);
	}
	return printer.str(k);
}

/**
 * @param typeOrItem {String|Object} If object, getType() is used
 * @returns {?DataClass} the DataClass if defined for this type
 * 
 * See also getType()
 */
const getClass = typeOrItem => {
	if ( ! typeOrItem) return;
	if (_.isString(typeOrItem)) {
		return allTypes[typeOrItem];
	}
	let type = getType(typeOrItem);
	return allTypes[type];
};
DataClass.class = getClass;

/**
 * @param dclass {Class} the class
 * @param name {String} name, because Babel might mangle the class.name property.
 */
DataClass.register = (dclass, name) => {
	if ( ! name) {
		console.warn("DataClass.register - no name for "+dclass.name+". This is NOT safe as Babel may mangle it.")
		name = dclass.name;
	}
	assert(name);
	if (allTypes[name]) {
		console.warn("DataClass.register() Double register for "+name, dclass, allTypes[name]);
	}
	allTypes[name] = dclass;
	// debug convenience
	if ( ! window[name]) window[name] = dclass;
	// Store the "proper" text name safe from Babel
	dclass._name = name;

	// js this binding BS -- doesnt work :(
	// Just avoid using isa "plain"
	// dclass.isa = dclass.isa.bind(dclass);

	// sanity check: no non static methods
	// NB: f is defined as dclass.f => static, as does dclass.f = inherited __proto__.f
	const nonStatic = Object.getOwnPropertyNames(dclass.__proto__)
		.filter(fname => ! dclass.hasOwnProperty(fname) && dclass.__proto__[fname] !== dclass[fname]);
	assert( ! nonStatic.length, "DataClasses can only have static methods: "+name+" "+JSON.stringify(nonStatic));		
	// sanity check: forbidden properties
	// if (dclass.__proto__.length) { false +ives :(
	// 	console.warn("DataClass.register() "+name+" Avoid using `length` as it can create confusion with arrays");
	// }
};

/**
 * Keep the defined types
 */
const allTypes = {};
// Debug hack: export classes to global! Don't use this in code - use import!
window.allTypes = allTypes
window.DataClass = DataClass;

const getName = DataClass.getName;


export {getType, getId, getName, getStatus, Meta, nonce, getClass};
export default DataClass;
