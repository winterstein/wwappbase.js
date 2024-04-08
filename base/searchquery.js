
import { assert, assMatch } from './utils/assert';
import DataClass from './data/DataClass';
import { is } from './utils/miscutils';

/**
 * Manipulate search query strings like a boss.
 * e.g.
 * `let sq = new SearchQuery("apples OR oranges"); 
 * SearchQuery.setProp(sq, "lang", "en")`
 * 
 * See DataLog for the original of this!
 * 
 * TODO we'll want more search capabilities as we go on
 */
class SearchQuery extends DataClass
{
	/** @type {!String} */
	query;

	/**
	 * e.g. ["OR", "a", ["AND", "b", {"near", "c"}]]
	 */
	tree;

	options;

	/**
	 * 
	 * @param {?String|SearchQuery} query 
	 * @param {?Object} options 
	 */
	constructor(query, options) {
		super();
		// DataClass._init(this, base); not needed??
		this.query = query || "";
		// NB: unwrap if the input is a SearchQuery
		if (this.query.query) this.query = this.query.query;
		this.options = Object.assign({}, SearchQuery.GENERAL_OPTIONS, options, this.query.options);
		SearchQuery.parse(this);
	}

} // ./SearchQuery
DataClass.register(SearchQuery, "SearchQuery");


SearchQuery._init = sq => {
	if (sq.tree) return;
	SearchQuery.parse(sq);
}


SearchQuery.parse = sq => {
	// HACK just space separate and crude key:value for now!
	let bits = sq.query.split(" ");
	let bits2 = bits.map(bit => {
		let kv = bit.match(/^([a-zA-Z_0-9]+):(.+)/);
		if (kv) return {[kv[1]]: kv[2]};
		return bit;
	});
	let op = SearchQuery.AND;
	if (bits.includes("OR")) {
		op = SearchQuery.OR;
	}
	// only one op needed (added below), ie [AND, a, b] not [AND,a,AND,b]
	bits2 = bits2.filter(v => v !== op);
	/**
	 * Return the expression tree, which is a nested array
	 * E.g. "a OR (b AND near:c)" --> ["OR", "a", ["AND", "b", ["near", "c"]]]
	 */
	sq.tree = [op, ...bits2];
}


/**
 * Convenience method.
 * IF propName occurs at the top-level, then return the value
 * @param {!SearchQuery} sq
 * @param {!string} propName 
 * @returns {?string}
 */
SearchQuery.prop = (sq, propName) => {
	SearchQuery._init(sq);
	let props = sq.tree.filter(bit => Object.keys(bit).includes(propName));
	// ??What to return if prop:value is present but its complex??
	if (props.length > 1) console.warn("SearchQuery.prop multiple values!", props, sq);
	if (props.length) {
		return props[0][propName];
	}
	return null;
}


/**
 * Set a top-level prop, e.g. vert:foo
 * @param {?SearchQuery|string} sq
 * @param {!String} propName 
 * @param {?String|Boolean} propValue If unset (null,undefined, or "" -- but not false or 0!), clear the prop. The caller is responsible for converting non-strings to strings - apart from boolean which thie method will handle, 'cos we're nice like that.
 * @returns {SearchQuery} a NEW SearchQuery. Use .query to get the string
 */
SearchQuery.setProp = (sq, propName, propValue) => {	
	assMatch(propName, String);
	if (_.isString(sq)) {
		sq = new SearchQuery(sq);
	}
	// boolean has gotchas, so lets handle it. But not number, as the caller should decide on e.g. rounding
	if (typeof(propValue) === "boolean") propValue = ""+propValue; // true/false
	assMatch(propValue, "?String");
	assMatch(propName, String, "searchquery.js - "+propName+" "+propValue);
	let newq = "";
	// remove the old
	if (sq) {
		assMatch(sq, SearchQuery);
		newq = snipProp(sq, propName);
	}
	// unset? (but do allow prop:false and x:0)
	if (propValue===null || propValue===undefined || propValue==="") {
		if ( ! newq) {
			// console.warn("SearchQuery.js null + null!",sq,propName,propValue);
			return new SearchQuery();
		}
		// already removed the old
	} else {
		// quote the value?
		let qpropValue = propValue.indexOf(" ") === -1? propValue : '"'+propValue+'"';
		newq = (newq? newq+" AND " : "") + propName+":"+qpropValue;
	}
	// Collapse duplicate ANDs
	newq = newq.replace(/\s+AND(\s+AND)+\s+/g, " AND ");
	// Trim leading, trailing, empty ANDs
	newq = newq.replace(/^\s*(AND\s+)+/g, "");
	newq = newq.replace(/(\s+AND)+\s*$/g, "");
	newq = newq.replace(/^\s*AND\s*$/, "");

	// done
	return new SearchQuery(newq.trim());
}


/**
 * 
 * @param {SearchQuery} sq
 * @param {String} propName
 * @returns {String}
 */
const snipProp = (sq, propName) => {
	assMatch(sq, SearchQuery);
	SearchQuery._init(sq);
	assMatch(propName,String);
	// Cut out the old value (use the parse tree to handle quoting)
	let tree2 = sq.tree.filter(bit => ! is(bit[propName]));
	let newq = unparse(tree2);
	return newq;
};


/**
 * Set several options for a top-level prop, e.g. "vert:foo OR vert:bar"
 * @param {SearchQuery?} [sq] If set, this is combined via AND!
 * @param {String} propName
 * @param {String[]} propValues Must not be empty
 * @returns a NEW SearchQuery
 */
SearchQuery.setPropOr = (sq, propName, propValues) => {	
	assMatch(propName, String, "searchquery.js "+propName+": "+propValues);
	assMatch(propValues, "String[]", "searchquery.js "+propName, propValues); // NB: Should we allow empty? No - ambiguous whether or(empty) should mean all or none
	assert(propValues.length, "searchquery.js - "+propName+" Cant OR over nothing "+propValues)
	// quote the values? HACK if they have a space
	let qpropValues = propValues.map(propValue => propValue.indexOf(" ") === -1? propValue : '"'+propValue+'"');
	// join by OR
	let qor = propName+":" + qpropValues.join(" OR "+propName+":");	

	// no need to merge into a bigger query? Then we're done :)
	if ( ! sq || ! sq.query) {
		return new SearchQuery(qor);
	}

	// AND merge...
	let newq = snipProp(sq, propName);
	newq = newq+" AND ("+qor+")";
	// HACK - trim ANDs??
	newq = newq.replace(/ AND +AND /g," AND ");
	if (newq.substr(0, 5) === " AND ") {
		newq = newq.substr(5);
	}
	if (newq.substr(newq.length-5, newq.length) === " AND ") {
		newq = newq.substr(0, newq.length - 5);
	}
	// done
	return new SearchQuery(newq.trim());
};


/**
 * Merge two queries with OR
 * @param {?String|SearchQuery} sq 
 * @returns a NEW SearchQuery
 */
SearchQuery.or = (sq1, sq2) => {
	return SearchQuery.op(sq1, sq2, SearchQuery.OR);
}


/**
 * 
 * @param {?string|SearchQuery} sq1 
 * @param {?string|SearchQuery} sq2 
 * @param {!string} op 
 * @returns {SearchQuery} Can be null if both inputs are null
 */
SearchQuery.op = (sq1, sq2, op) => {	
	// convert to class
	if (typeof(sq1)==='string') sq1 = new SearchQuery(sq1);
	if (typeof(sq2)==='string') sq2 = new SearchQuery(sq2);

	// HACK remove (works for simple cases)
	// NB: done before the null tests as this handles null differently to and/or 
	if (SearchQuery.REMOVE === op) {
		if ( ! sq2 || ! sq2.query) return sq1;
		// null remove thing => null??
		if ( ! sq1 || ! sq1.query) return sq1;
		// (assume AND) pop the 1st tree op, filter out nodes that appear in sq2
		let t2 = sq1.tree.slice(1).filter(
			n1 => ! _.find(sq2.tree, n2 => _.eq(JSON.stringify(n1), JSON.stringify(n2)))
		);
		t2 = [sq1.tree[0]].concat(t2);
		let u = unparse(t2);
		// console.warn(sq1.tree, sq2.tree, t2, u);
		let newsq = new SearchQuery(u);
		return newsq;
	}

	// one is falsy? then just return the other
	if ( ! sq2) return sq1;
	if ( ! sq1) return sq2;
	if ( ! sq1.query) return sq2;
	if ( ! sq2.query) return sq1;

	// Same top-level op?
	if (op === sq1.tree[0] && op === sq2.tree[0]) {
		let newq = sq1.query+" "+op+" "+sq2.query;	
		return new SearchQuery(newq);
	}

	// CRUDE but it should work -- at least for simple cases
	let newq = bracket(sq1.query)+" "+op+" "+bracket(sq2.query);
	return new SearchQuery(newq);
};


/**
 * Add brackets if needed.
 * @param {!String} s 
 */
const bracket = s => s.includes(" ")? "("+s+")" : s;


/**
 * Merge two queries with AND
 * @param {?String|SearchQuery} sq 
 * @returns {SearchQuery} a NEW SearchQuery
 */
SearchQuery.and = (sq1, sq2) => {
	return SearchQuery.op(sq1, sq2, SearchQuery.AND);
}


/**
 * Remove sq2 from sq1, e.g. remove("foo AND bar", "bar") -> "foo"
 * @param {?String|SearchQuery} sq1
 * @param {?String|SearchQuery} sq2
 * @returns {SearchQuery} a NEW SearchQuery
 */
SearchQuery.remove = (sq1, sq2) => {
	return SearchQuery.op(sq1,sq2,SearchQuery.REMOVE);
}


/**
 * @param {?SearchQuery} sq 
 * @returns {!string}
 */
SearchQuery.str = sq => sq? sq.query : '';


/**
 * Convert a parse tree back into a query string
 * @param {Object[]|string} tree 
 * @returns {string}
 */
const unparse = tree => {
	// a search term?
	if (typeof(tree)==='string') return tree;
	// key:value?
	if ( ! tree.length) {
		let keys = Object.keys(tree);
		assert(keys.length === 1);
		return keys[0]+":"+tree[keys[0]];
	}
	if (tree.length===1) return tree[0]; // just a sole keyword
	let op = tree[0];
	let bits = tree.slice(1);
	// TODO bracketing
	let ubits = bits.map(unparse);
	return ubits.join(" "+op+" ");
};


// The built in boolean operators
SearchQuery.AND = "AND";
SearchQuery.OR = "OR";
SearchQuery.NOT = "NOT";
/**
 * Hack for saying "this search, but removing this term"
 */
SearchQuery.REMOVE = "RM";

SearchQuery.GENERAL_OPTIONS = {
	OR: ["OR", ","],
	AND: ["AND"],
	NOT: ["-"]
};

// debug hack
window.SearchQuery = SearchQuery;

export default SearchQuery;
