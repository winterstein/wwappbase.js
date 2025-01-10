/**
	List of server results -- for use with Crud ActionMan.list and ListLoad

	format:

	{
		hits: [{id, type, status}]
		total: Number
		??index ??start ??first: Number ??cursor
	}

*/
import { assert, assMatch } from '../utils/assert';
import DataClass, {getType, getId, nonce} from './DataClass';
import { Item } from '../plumbing/DataStore';

/**
 * Reference for a data item. Given this, you can get the data item from DataStore.
 * This can also _be_ a data-item itself.
 */
class Hit {
	id;
	type;
	status;
}

/** Based on ES, a (maybe partial) List of hits with total */
class List extends DataClass {
	/**
	 * @type {Hit[]}
	 */
	hits;

	/** @type {Number} */
	total;

	/** @type {Number} If total is uncertain */
	estimate;

	/** @type {?string} token to fetch the next batch */
	next;

	/** @type {?string} If a `next` token was used for this batch */
	after;

	/** @type {?string[]} Any `next` tokens that have been consumed */
	_batches;

	/**
	 * 
	 * @param {?Object|Hit[]|Item[]} base If an array, then set hits=base. Otherwise use as a base for {hits, total}
	 */
	constructor(base) {
		super();
		if ( ! base) base = [];
		if (Array.isArray(base)) {
			this.hits = base;
			this.total = base.length;
			base = null;
		}
		DataClass._init(this, base);
	}

	/** more lenient duck typing: does it have a hits array? */
	static isa(listy) {
		if ( ! listy) return false;
		if (super.isa(listy, List)) return true;
		return listy.hits && listy.hits.length !== undefined;
	}
};
DataClass.register(List, "List");

const This = List;
export default List;

/**
 * @param {?List} list Can be null (returns null)
 * @returns {?Item[]}
 */
List.hits = list => list? (List.assIsa(list) && list.hits) : null;
/**
 * Convenience for first-item or null
 * @param {?List} list 
 * @returns {?Item}
 */
List.first = list => list? List.hits(list)[0] : null;

/**
 * 
 * @param {?List} list 
 * @returns {?Number}
 * WARNING total can double count if type=all-bar-trash
 */
List.total = list => {
	if ( ! list) return null;
	return list.total || list.estimate || list.hits.length;
}

/**
 * Add in place, item to list
 * @param {*} item 
 * @param {List} list 
 * @param {?int} index Optional insertion index (defaults to the end of the list)
 */
List.add = (item, list, index) => {
	const items = List.hits(list);
	if (index !== undefined) {
		items.splice(index, 0, item);
	} else {
		items.push(item);
	}
	list.total = items.length;
	return list;
};

/**
 * Remove in place, item to list
 * @param {*} item Can match on id
 * @param {List} list 
 * @returns {Boolean} true if a remove was made
 */
List.remove = (item, list) => {
	assert(item && list, "List.js NPE");
	assert(list.hits, "No hits? Not a 'List'!", list);
	const idi = getId(item) || nonce();
	let h2 = list.hits.filter(h => h !== item && getId(h) !== idi);
	const r = h2.length < list.hits.length;
	list.hits = h2;
	return r;
};


/**
 * Is this used??
 * 
 * @param {List[]} lists Can contain nulls
 * @returns {!List}
 */
List.union = (...lists) => {
	const ulist = new List([]);
	lists.forEach(list => {
		if ( ! list) return;
		assert( ! Array.isArray(list), "List.union takes List[]");
		if (list.hits) ulist.hits.push(...list.hits);
		if (list.total) ulist.total += list.total;
		else {
			console.warn("List.union() No total?!",list);
		}
	});
	return ulist;
};

/**
 * @param {List} list This will be modified!
 * @param {List} more
 * @returns {!List} the modified input list
 */
List.extend = (list, more) => {
	if ( ! list._batches) list._batches = [];
	if (more.after && list._batches.includes(more.after)) {
		console.warn("extended already", list, more);
		return list;
	}
	list.hits.push(...more.hits);
	if (list.total && list.total < list.hits.length) list.total = list.hits.length;
	if (list.estimate && list.estimate < list.hits.length) list.estimate = list.hits.length;
	list.next = more.next;
	if ( ! more.next) console.log("end of list (no next)", list, more);
	list._batches.push(more.after);
	return list;
};


// TODO page cursor logic