/**
 * Replaces SJTest
 * @author Daniel Winterstein (http://winterstein.me.uk)
 */

 /**
 * An assert function.
 * Error handling can be overridden by replacing assertFailed()
 * @param betrue
 *            If true (or any truthy value), do nothing. If falsy, console.error and throw an Error.
 *            HACK: As a special convenience, the empty jQuery result (ie a jquery select which find nothing) is considered to be false!
 *            For testing jQuery selections: Use e.g. $('#foo').length
 * @param msg
 *            Message on error. This can be an object (which will be logged to console as-is,
 *            and converted to a string for the error).
 * @returns betrue on success. This allows assert() to be used as a transparent wrapper.
 * E.g. you might write <code>let x = assert(mything.propertyWhichMustExist);</code>
 */
const assert = function(betrue, ...msgs) {
	if (betrue) {
		if (betrue.jquery && betrue.length===0) {
			// empty jquery selection - treat as false
			if ( ! msgs) msgs = ["empty jquery selection"];
			assertFailed(msgs);
			return;
		}
		// success
		return betrue;
	}
	assertFailed(msgs || betrue);
};
/**
 * Handle assert() failures. Users can replace this with a custom handler.
 * @param {Object[]} msgs
 */
let assertFailed = function(msgs) {
	// we usually pass in an array from ...msg
	console.error("assert", ...msgs);
	// A nice string?
	let smsg = str(msgs);
	throw new Error("assert-failed: "+smsg);
};
/**
 * 
 * @param fn Replace the default error handler
 */
const setAssertFailed = fn => {
	assertFailed = fn;
}

/**
 * value, matcher
 * @param msg {?string}
 * @returns value
 */
const assMatch = function(value, matcher, msg) {
	if (match(value, matcher)) {
		return value;	// All OK
	}
	let fullMsg = (msg? msg+" " : '') + "a-match: "+str(value) + " !~ " + str(matcher);
	assert(false, fullMsg);
	return value; // if assert has been silenced by the user - carry on
};

/**
 * Like instanceof, but more robust.
 *
 * @param obj
 *            Can be null/undefined (returns false)
 * @param klass
 *            e.g. Number
 * @returns {Boolean} true if obj is an example of klass.
 */
const isa = function(obj, klass) {
	if (obj === klass) return true; // This can be too lenient, e.g. Number is not a Number. But it's generally correct for a prototype language.
	if (obj instanceof klass) return true;
	// HACK for DataClass
	if (klass.isa instanceof Function) {
		return klass.isa(obj);
	}
	for(let i=0; i<10; i++) { // limit the recursion 10-deep for safety
		if (obj === null || obj === undefined) return false;
		if ( ! obj.constructor) return false;
		if (obj.constructor == klass) return true;
		obj = obj.prototype;
	}
	return false;
};


/** Flexible matching test
* @param value
* @param matcher Can be another value.
	Or a Class.
	Or a JSDoc-style class spec such as "?Number" or "Number|Function" or "String[]".
	Or a regex (for matching against strings).
	Or true/false (which match based on ifs semantics, e.g. '' matches false).
	Or an object (which does partial matching, allowing value to have extra properties).
	Or a (Good-Loop) DataClass (which match based on the isa() function)
 @returns true if value matches, false otherwise
*/
const match = function(value, matcher) {
	// TODO refactor to be cleaner & recursive
	// simple
	if (value == matcher) return true;
	if (matcher === undefined) {
		console.warn("assert.js match(): no matcher?!", value);
		return value===null || value===undefined; // probably an error, but they might be testing for is-value-undefined
	}
	let sValue = ""+value;
	if (typeof matcher==='string') {
		// JSDoc optional type? e.g. ?Number
		if (matcher[0] === '?' && (value===null || value===undefined)) {
			return true;
		}
		if (value===null || value===undefined) return false;
		// Get the class function(s)
		let ms = matcher.split("|");
		for(let mi=0; mi<ms.length; mi++) {
			let mArr = ms[mi].match(/^\??(\w+?\[?\]?)!?$/);
			if ( ! mArr) break;
			let m = mArr[1];
			if (sValue===m) return true;
			if (m==='Number'||m==='number') { // allow string to number conversion
				if (typeof value === 'number' && ! isNaN(value)) return true;
				let nv = parseFloat(value);
				if (nv || nv===0) return true;
				continue;
			}
			// array syntax?
			if (m.substr(m.length-2,m.length)==='[]') {
				if (value.length===undefined) return false;
				let arrayType = m.substr(0, m.length-2);
				for(let vi=0; vi<value.length; vi++) {
					if ( ! match(value[vi], arrayType)) {
						return false;
					}
				}
				return true;
			}
			try {
				// eval the class-name
				let fn = new Function("return "+m);
				let klass = fn();
				if (isa(value, klass)) {
					return true;
				}
			} catch(err) {
				// eval(m) failed to find a class
				// A non-global ES6 class?
				// Note: this is just for the string matcher. If the user put in a proper class object, we're fine.
				let v = value;
				while(true) {
					if (v.constructor && v.constructor.name === m) {
						return true;
					}
					v = Object.getPrototypeOf(v);
					if ( ! v) break;
				}
			} // ./try class test
			// type? c.f. DataClass.js and FlexiGson
			if (typeMatch(value, m)) return true;
		} // ./ for matcher-bit
		return false;
	} // string matcher

	// lenient true/false
	if(matcher===false && ! value) return true;
	if (matcher===true && value) return true;
	// RegExp?
	if (matcher instanceof RegExp) {
		try {
		// let re = new RegExp("^"+matcher+"$"); // whole string match
			let matched = matcher.test(sValue);
			if (matched) return true;
		} catch(ohwell) {}
	}

	let lazyMatcher = null;
	if (matcher===Number) { // allow string to number conversion
		if (typeof value === 'number' && ! isNaN(value)) return true;
		let nv = parseFloat(value);
		return (nv || nv===0);
	}
	if (typeof matcher==='function') {
		// Class instanceof test
		if (matcher.constructor /*
								 * fn + constructor => this is a class
								 * object, so _could_ be a prototype
								 */) {
			if (isa(value, matcher)) {
				return true;
			} else {
				return false;
			}
		} else {
			// matcher is a function -- lazy value?
			try {
				lazyMatcher = matcher();
				if (value==lazyMatcher) return true;
			} catch(ohwell) {}
		}
	}
	// Lazy value?
	if (typeof value==='function') {
		try {
			let hardValue = value();
			// ??Recurse??
			if (hardValue==matcher) return true;
			// Both lazy?
			if (lazyMatcher && hardValue==lazyMatcher) return true;
		} catch(ohwell) {}
	}

	// DataClass.js json "class" object and value?
	if (typeMatch(value, matcher)) {
		return true;
	}

	// partial object match? e.g. {a:1} matches {a:1, b:2}
	if (typeof matcher==='object' && typeof value==='object') {
		for(let p in matcher) {
			let mv = matcher[p];
			let vv = value[p];
			if (mv != vv) {
				return false;
			}
		}
		return true;
	}

	return false;
};

/**
 * Schema.org type info (see also DataClass.js)
 * @param matcher {String|DataClass|Object} NB: Only String and DataClass can succeed. If an arbitrary Object, this will return false.
 */
function typeMatch(value, matcher) {
	if ( ! value) return false;
	let m = typeof(matcher)==='string'? matcher : (matcher['@type']==='DataClass' && matcher.type);
	if ( ! m) return false;
	if (value.type === m || value['@type'] === m) {
		return true;
	}
	// FlexiGson Java class type info
	let fgt = typeof(value['@class']) === 'string' && value['@class'].substr(value['@class'].length - m.length); 
	if (fgt === m) {
		return true;
	}
	// isa?
	if (typeof(matcher.isa)==='function') {
		try {
			let yeh = matcher.isa(value);
			return yeh;
		} catch(err) {
			console.warn("typeMatch - isa error: "+err+" for "+value+" "+matcher);
			// oh well
		}
	}
	return false;
}


/**
 * str -- Robust stringify. Use Winterwell's printer.str() if available. Else a simple version.
 */
let str = function(obj) {
	// Use printer.str if defined (test at runtime to avoid ordering or race conditions on loading)
	if (typeof(printer) !== 'undefined' && printer.str) {
		return printer.str(obj);
	}
	try {
		let msg = JSON.stringify(obj) || ""+obj;
		return msg;
	} catch(circularRefError) {
		if (obj instanceof Array) {
			let safe = [];
			for(let i=0; i<obj.length; i++) {
				safe[i] = str(obj[i]);
			}
			return JSON.stringify(safe);
		}
		// safety first
		let safe = {};
		for(let p in obj) {
			let v = obj[p];
			if (typeof(v) == 'function') continue;
			else safe[p] = ""+v;
		}
		return JSON.stringify(safe);
	}
}; // str()

export {
	assert, match, isa, assMatch, str, setAssertFailed
}
if ( ! window.assert) window.assert = assert;
if ( ! window.assMatch) window.assMatch = assMatch; // a bit dubious
if ( ! window.str) window.str = str;
