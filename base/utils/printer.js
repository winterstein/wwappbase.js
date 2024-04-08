/**
 * file: Printer.js Purpose: converts objects into html.
 *
 * Example Usage:
 *
 * printer.str(myObject);
 *
 * or
 *
 * new Printer().str(myObject)
 *
 * Good points: passing a Printer object in to another
 * method allows custom tweaking of the html in a modular fashion.
 *
 * @depends underscore.js
 */

function Printer() {
}

/**
 * Matches
 *
 * @you. Use group 2 to get the name *without* the @
 */
Printer.AT_YOU_SIR = /(^|\W)@([\w\-]+)/g;

/**
 * Matches #tag. Use group 2 to get the tag *without* the #
 */
Printer.HASHTAG = /(^|[^&A-Za-z0-9/])#([\w\-]+)/g;

Printer.URL_REGEX = /https?\:\/\/[0-9a-zA-Z]([-.\w]*[0-9a-zA-Z])*(:(0-9)*‌​)*(\/?)([a-zA-Z0-9\-‌​\.\?\,\'\/\\\+&amp;%‌​\$#_]*)?/g;

/**
 * @deprecated use prettyNumber
 * @param x
 * @param n
 * @return x to n significant figures
 */
Printer.prototype.toNSigFigs = function(x, n) {
	return this.prettyNumber(x, n);
};

/**
 * @param {?Number} x The number to format. If null/undefined, return ''.
 * Convenience for new Intl.NumberFormat().format() directly
 * @param {?Number} sigFigs Default to 3
 * @param {?Number} minimumFractionDigits e.g. 2 for preserve-pence with money amounts
 */
Printer.prototype.prettyNumber = function(x, sigFigs=3, minimumFractionDigits) {
	if (x===undefined || x===null) return '';
	if (isNaN(x)) return '';
	if (x==0) return "0";
	try {
		let options = {maximumSignificantDigits:sigFigs, minimumFractionDigits};
		let snum = new Intl.NumberFormat('en-GB', options).format(x);
		return snum;
	} catch(er) {
		console.warn("toNSigFigs "+er); // Handle the weird Intl undefined bug, seen Oct 2019, possibly caused by a specific phone type
		return ""+x;
	}
};


const roundFormat = new Intl.NumberFormat('en-GB', {maximumFractionDigits: 0});
const oneDecimalFormat = new Intl.NumberFormat('en-GB', {maximumFractionDigits: 1});


/**
 * Round and comma-group a number. Optionally alow one decimal place on single-digit numbers.
 * @param {?Number} x The number to print
 * @param {?Boolean} allowOneDigitDecimal If true, one-digit numbers will allow (but not enforce) one more digit after the decimal point.
 */
Printer.prototype.prettyInt = function(x, allowOneDecimal) {
	if (x == null) return ''; // == instead of === also catches undefined
	if (x == 0) return '0';
	try {
		const format = (x > -10 && x < 10 && allowOneDecimal) ? oneDecimalFormat : roundFormat;
		return format.format(x);
	} catch (e) {
		console.warn('prettyInt error:', e); // Handle the weird Intl undefined bug, seen Oct 2019, possibly caused by a specific phone type
		return '' + x;
	}
};



/**
* Converts objects to a human-readable string. Uses `JSON.stringify`, with the
* ability to handle circular structures. The returned string uses the following
* notation:
*
* Circular-object: {circ} Circular-array: [circ] jQuery: {jQuery}
*
* @param {Object} object The object to convert to a string.
* @returns {String} Representation of the supplied object.
*/
Printer.prototype.str = function (object) {
	if (typeof(object)==='string') return object;
	if (typeof(object)==='number') return this.prettyNumber(object);
	try {
		return JSON.stringify(object);
	} catch (error) {
		return JSON.stringify(escapeCircularReferences(object));
	}
};


function escapeCircularReferences(object, cache) {
	if ( ! object) return null;
	var escapedObject;

	if (!cache) {
		cache = [];
	}

	if (object.jquery) {
		return '{jQuery}';
	} else if (_.isObject(object)) {
		if (cache.indexOf(object) > -1) {
			return '{circ}';
		}

		cache.push(object);

		escapedObject = {};

		for (var key in object) {
			if (object.hasOwnProperty(key)) {
				var value = escapeCircularReferences(object[key], cache);

				if (value !== undefined) {
					escapedObject[key] = value;
				}
			}
		}
	} else if (_.isArray(object)) {
		if (cache.indexOf(object) > -1) {
			return '[circ]';
		}

		cache.push(object);

		escapedObject = [];

		for (var i = 0, j = object.length; i < j; i++) {
			var value = escapeCircularReferences(object[i], cache);

			if (value) {
				escapedObject.push(value);
			} else {
				escapedObject.push(null);
			}
		}
	} else {
		escapedObject = object;
	}

	return escapedObject;
}

/**
 * Convert user text (eg a tweet) into html. Performs a clean, converts
 * links, and some markdown
 *
 * @param contents The text context to be replaced. Can be null/undefined (returns "").
 * @param context The message item (gives us the service this message is from for internal links)
 * @param external When set true will write links to the service instead of internally
 */
Printer.prototype.textToHtml = function (contents, context, external) {
	if ( ! contents) return "";
	var service = context && context.service? context.service : null;
	// TODO This is too strong! e.g. it would clean away < this >, or "1<2 but 3>2"
	// TODO convert @you #tag and links ??emoticons -- See TwitterPlugin
	// contents = cleanPartial(contents);

	// convert & > into html entities (before we add any tags ourselves)
	contents = contents.replace(/</g,'&lt;');
	contents = contents.replace(/>/g,'&gt;');
	// &s (but protect &s in urls)
	contents = contents.replace(/(\s|^)&(\s|$)/g,'$1&amp;$2');

	// Paragraphs & markdown linebreaks
	if (service != 'twitter' && service != 'facebook' && service != 'youtube') {
		// only one br for a paragraph??
		contents = contents.replace(/\n\n+/g,"<br/>");
		contents = contents.replace(/   \n/g,"<br/>");
	}

	// TODO lists +
	// var ulli = /^ ?-\s*(.+)\s*$/gm;
	// contents = contents.replace(ulli, "<li>$1</li>");
	if (service==='TODOsoda.sh') {
		// Checkboxes from github style []s
		contents = contents.replace(/\[( |x|X)\](.+$)/gm, function(r) {
			console.log(r);
			var on = r[1] === 'x' || r[1] === 'X';
			return "<label><input class='subtask' type='checkbox' "+(on?"checked='true'":'')+" /> "+r.substring(3).trim()+"</label>";
		});
	}

	// normalise whitespace
	contents = contents.replace(/\s+/g," ");

	// links
	if(external) {
		// NOTE: _parent required for IFRAME embed
		contents = contents.replace(Printer.URL_REGEX, "<a href='$1' target='_blank' rel='nofollow' target='_parent'>$1</a>");
	} else {
		contents = contents.replace(Printer.URL_REGEX, "<a href='$1' target='_blank' rel='nofollow'>$1</a>");
	}

	// TODO break-up over-long urls?
	// @username to their profile page
	if(external) {
		if(service == 'twitter') {
			contents = contents.replace(Printer.AT_YOU_SIR, "$1<a href='https://twitter.com/$2' target='_parent'>@$2</a>");
		} else if(service == 'facebook') {
			// TODO: Is linking @Name in facebook even possible?
		}
	} else {
		contents = contents.replace(Printer.AT_YOU_SIR, "$1<a href='/profile?xid=$2%40"+service+"'>@$2</a>");
	}

	// hashtag to a twitter search
	if(external) {
		if(service == 'twitter') {
			contents = contents.replace(Printer.HASHTAG, "$1<a href='https://twitter.com/search/%23$2' target='_parent'>#$2</a>");
		} else if(service == 'facebook') {
			// TODO: Is linking @Name in facebook even possible?
		}
	} else {
		if (service == 'soda.sh') { /* hashtags in notes are sodash tags */
			contents = contents.replace(Printer.HASHTAG, "$1<a href='/stream?tag=$2'>#$2</a>");
		} else {
			contents = contents.replace(Printer.HASHTAG, "$1<a href='/stream?q=%23$2'>#$2</a>");
		}
	}

	// a bit of markdown/email-markup
	contents = contents.replace(/(^|\s)\*(\w+|\w.+?\w)\*($|\s)/g, "$1<i>*$2*</i>$3");
	contents = contents.replace(/(^|\s)_(\w+|\w.+?\w)_($|\s)/g, "$1<i>_$2_</i>$3");

	// correct for common numpty errors, such as encoded <b> or <i> tags
	contents = contents.replace(/&lt;(\/?[biBI])&gt;/g, "<$1>");
	// ?? special effects, e.g. logos or emoticons?

	return contents;
}; // ./Printer.textToHtml()

/**
 * Convert milliseconds into a nice description.
 * TODO a better idea, would be to convert into some sort of Dt object, with a nice toString()
 * @param msecs {number} a time length in milliseconds
 */
Printer.prototype.dt = function(msecs) {
	// days?
	if (msecs > 1000*60*60*24) {
		var v = msecs / (1000*60*60*24);
		return this.toNSigFigs(v, 2)+" days";
	}
	if (msecs > 1000*60*60) {
		var v = msecs / (1000*60*60);
		return this.toNSigFigs(v, 2)+" hours";
	}
	if (msecs > 1000*60) {
		var v = msecs / (1000*60);
		return this.toNSigFigs(v, 2)+" minutes";
	}
	var v = msecs / 1000;
	return this.toNSigFigs(v, 2)+" seconds";
};

function encodeHashtag(text, service) {
	service = (service || '')
		.toLowerCase()
		.replace(/\W/g, '');

	switch (service) {
	case 'sodash':
		return text.replace(HASHTAG, '$1<a href="/stream?tag=$2">#$2</a>');
	default: // Return internal link by default.
		return text.replace(HASHTAG, '$1<a href="/stream?q=$2">#$2</a>');
	}
}

function encodeReference(text, service) {
	service = (service || '')
		.toLowerCase()
		.replace(/\W/g, '');

	switch (service) {
	case 'twitter':
		return text.replace(AT_YOU_SIR, '$1<a href="https://twitter.com/%2" target="_blank">@$2</a>');
	default: // Return internal link by default.
		return text.replace(AT_YOU_SIR, '$1<a href="/profile?who=$2">@$2</a>');
	}
}

//	export
/** Default Printer -- can be replaced. */
const printer = new Printer();
if (typeof module !== 'undefined') {
	module.exports = printer;
}

// for debug
if ( ! window.printer) window.printer = printer;
if ( ! window.str) window.str = printer.str;
