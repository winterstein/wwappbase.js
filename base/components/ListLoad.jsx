import React, { useEffect, useRef, useState } from 'react';

import { Button, Card, CardBody, Form, Pagination, PaginationItem, PaginationLink } from 'reactstrap';

import { assert, assMatch } from '../utils/assert';

import { ellipsize, is, space, stopEvent, yessy } from '../utils/miscutils';
import Misc from './Misc';
import PropControl from './PropControl';
import DataStore, { Item, Ref } from '../plumbing/DataStore';
import ActionMan from '../plumbing/ActionManBase';
import { getDataItem, saveAs, keyForType, getDataList, getMoreDataList } from '../plumbing/Crud';
import { getType, getId, nonce, getClass, getStatus } from '../data/DataClass';

import ErrAlert from './ErrAlert';
import Icon from './Icon';
import SimpleTable, { DownloadCSVLink } from './SimpleTable';
import KStatus from '../data/KStatus';
import AThing from '../data/AThing';
import List from '../data/List';
import { A, modifyPage } from '../plumbing/glrouter';
import Roles from '../Roles';

import Pager from './Pager';

const DEFAULT_PAGE_SIZE = 100;

/**
 * Provide a list of items of a given type.
 * Clicking on an item sets it as the nav value.
 * Get the item id via:
 *
 * 	const path = DataStore.getValue(['location','path']);
 * 	const itemId = path[1];
 *
 * @param {Object} p
 * @param {String} p.type from C.TYPES
 * @param {String} [p.q] - Optional query e.g. advertiser-id=pepsi. See `filter` for prefix search
 * Note: that filter can add to this
 * @param {String} [p.sort] - Optional sort order, e.g. "start-desc". Defaults to `created-desc`. NB: AThing has created since May 2020.
 * If the item does not have a created field -- pass in a different sort order, or "" for unsorted.
 * TODO test "" works
 * @param {String} [p.filter] - Set a filter. Do NOT use this and canFilter. This will query the backend via `prefix`
 * @param {Function} [p.filterFn] - A local filter function. Can be combined with filter/canFilter.
 * 	(item, index, array) => boolean
 * @param {Function} [p.transformFn] - do some transformation on the list after all filtering/sorting. should return a new array
 * @param {List} [p.list] No loading - just use this list of hits
 * @param {Boolean} [p.canFilter] - If true, offer a text filter. This will be added to q as a prefix filter.
 * @param {Boolean} [p.canCreate] - If set, show a Create button
 * @param {Boolean} [p.canDelete] - If set, show delete buttons
 * @param {Boolean} [p.cannotClick] - If set, do not use an a wrapper or have an onPick handler. Use-case: for lists which don't link through to pages.
 * @param {Boolean} [p.dataspace] - If set, send to server as a filter
 * @param {boolean} [p.filterLocally] - If true, do not call the server for filtering
 * @param {String} [p.start] - optional date filter
 * @param {String} [p.status] - e.g. "Draft"
 * @param {String} [p.servlet] - Deprecated - use navpage instead
 * @param {String} [p.navpage] - e.g. "publisher" If unset, a default is taken from the url.
 * Best practice is to set navpage to avoid relying on url behaviour.
 * @param {Function} [p.ListItem] JSX if set, replaces DefaultListItem.
 * 	ListItem only has to describe/present the item.
 * 	NB: On-click handling, checkboxes and delete are provided by ListItemWrapper.
 * 	Input props: {type, servlet, navpage, item, sort, items, nameFn, onClick}
 * @param {Function} [p.nameFn] passed to ListItem, to have custom name extraction
 * @param {boolean} [p.notALink] - (Deprecated - see cannotClick) Normally list items are a-tag links. If true, use div+onClick instead of a, so that the item can hold a tags (which don't nest).* 
 * @param {String} [p.itemClassName] - If set, overrides the standard ListItem btn css classes
 * @param {boolean} [p.hideTotal] - If true, don't show the "Total about 17" line
 * @param {Object} [p.createBase] - Use with `canCreate`. Optional base object for any new item. NB: This is passed into createBlank.
 * @param {KStatus} [p.preferStatus] See DataStpre.resolveRef E.g. if you want to display the in-edit drafts
 * @param {Boolean} [p.hasFilter] - deprecated - use canFilter
 * @param {Boolean} [p.unwrapped] If set don't apply a ListItemWrapper (which has the standard on-click behaviour and checkbox etc controls)
 * @param {React.Element|String} [p.noResults] Message to show if there are no results
 * @param {Function} [p.onClickItem] Custom non-navigation action when list item clicked
 * @param {Function} [p.onClickWrapper] Custom non-navigation action when list item wrapper is clicked. Like onClickItem but it applies one level up the dom.
 * @param {Function} [p.pageSelectID] If supplied, the current page number will be stored as a URL param under this key.
 * @param {Number} [p.pageSize] Number of items per page, default 100
 * @param {Function|Object} [p.selected] Currently selected object.
 * 		Used to set initial page number in e.g. multi-pane contexts where items can be selected without navigating away from the list.
 * @param {Boolean} [p.scrollOnPage=true] Scroll to top when switching pages in the list (default true)
 * @param {Object} [p.otherParams] Optional extra params to pass to getDataList() and on to the server.
 */
function ListLoad({ type, status, servlet, navpage,
	checkboxes,
	canDelete, canCopy, canCreate, 
	canFilter,
	cannotClick,
	createBase,
	className,
	dataspace,
	q,
	start, end,
	sort = 'created-desc',
	filter, filterFn, filterLocally,
	hasFilter, 
	itemClassName,
	transformFn,
	list,
	ListItem = DefaultListItem,
	nameFn,
	hasCsv, csvColumns, hideCsvColumns,
	noResults,
	notALink,
	preferStatus,
	hideTotal,
	pageSize = DEFAULT_PAGE_SIZE,
	unwrapped,
	onClickItem,
	onClickWrapper,
	pageSelectID,
	selected,
	scrollOnPage = true,
	// TODO sometime hasCsv, csvFormatItem,
	otherParams = {}
}) {
	// console.log("render ListLoad");
	// assert(C.TYPES.has(type), "ListLoad - odd type " + type);
	if (!status) {
		if (!list) console.error("ListLoad no status :( defaulting to ALL_BAR_TRASH", type);
		status = KStatus.ALL_BAR_TRASH;
	}
	assert(KStatus.has(status), "ListLoad - odd status " + status);
	// widget settings TODO migrate to useState so we can have multiple overlapping ListLoads
	// const [foo, setFoo] = useState({});
	// ??preserves state across q and filter edits -- is that best??
	const widgetPath = ['widget', 'ListLoad', type, status];
	if (servlet && !navpage) {
		console.warn("ListLoad.jsx - deprecated use of servlet - please switch to navpage");
	}
	if (!canFilter) canFilter = hasFilter; // for old code
	if (!navpage) navpage = servlet || DataStore.getValue('location', 'path')[0]; //type.toLowerCase();
	if (!servlet) servlet = navpage;
	if (!servlet) {
		console.warn("ListLoad - no servlet? type=" + type);
		return null;
	}
	assMatch(servlet, String);
	assMatch(navpage, String);
	assert(navpage && navpage[0] !== '#', "ListLoad.jsx - navpage should be a 'word' [" + navpage + "]");
	// store the lists in a separate bit of appstate
	// from data.
	// Downside: new events dont get auto-added to lists
	// Upside: clearer
	// NB: case-insentive filtering
	if (canFilter) {
		assert(!filter, "ListLoad.jsx - Do NOT use filter and canFilter props");
		filter = DataStore.getValue(widgetPath.concat('filter'));
	}
	const rawFilter = filter; // TODO case is needed for id matching -- Where/how best to handle that?
	if (filter) filter = filter.toLowerCase(); // normalise

	let fastFilter, isLoading, error;
	let getListParams = { type, status, q, start, end, sort, dataspace, ...otherParams };
	if (!list) { // Load!
		// Load via ActionMan -- both filtered and un-filtered
		// (why? for speedy updates: As you type in a filter keyword, the front-end can show a filtering of the data it has, 
		// while fetching from the backedn using the filter)
		let pvItemsFiltered = filter && !filterLocally ? getDataList({ type, status, q, start, end, prefix: rawFilter, dataspace, sort, ...otherParams }) : { resolved: true };
		let pvItemsAll = getDataList(getListParams);
		let pvItems = pvItemsFiltered.value ? pvItemsFiltered : pvItemsAll;
		// filter out duplicate-id (paranoia: this should already have been done server side)
		// NB: this prefers the 1st occurrence and preserves the list order.
		list = pvItems.value;
		fastFilter = ! pvItemsFiltered.value; // NB: pvItemsFiltered.resolved is artificially set true for filterLocally, so dont test that
		isLoading = ! (pvItemsFiltered.resolved && pvItemsAll.resolved);
		error = pvItems.error;
		if (filterFn || ! pvItemsFiltered.resolved) {
			if ( ! is(hideTotal)) hideTotal = true; // NB: better to show nothing than incorrect info. Unless the caller explicitly asked for hideTotal=false
		}
	} else {
		fastFilter = true;
		isLoading = false;
		if (filterFn && ! is(hideTotal)) {
			hideTotal = true;
		}
	}
	const hits = List.hits(list);
	let total = list && List.total(list); // FIXME this ignores local filtering

	// ...filter / resolve
	let items = resolveItems({ hits, type, status, preferStatus, filter, filterFn, fastFilter, transformFn });
	if (items && hits && hits.length === total && items.length < hits.length) {
		// filtered out locally - reduce the total
		total = items.length;
	}

	// HACK: an exact id match comes first (this is important for PropControlDataItem, and arguably useful elsewhere)
	if (rawFilter) {
		const exactMatch = items.find(item => getId(item)===rawFilter);
		if (exactMatch) {
			items = items.filter(item => item !== exactMatch);
			items.unshift(exactMatch);
		}
	}

	// NB: you can get truncated lists with pageSize but no pageSelectID (e.g. see PropControlDataItem)
	// Read the url for a stored page number - if absent default to 1.
	const pageCount = Math.ceil(total / (pageSize || total)); // no paging = total/total = 1 page
	const clampPage = n => Math.max(Math.min(pageCount || Infinity, n), 1); // Clamp page number to [1 .. pageCount]
	const pageFromUrl = pageSelectID ? DataStore.getUrlValue(pageSelectID) : 0;

	// Internal value for page - URL value or 1
	const [page, setPageRaw] = useState(pageFromUrl);
	// Go to page number, update URL param if used, and scroll to top
	const thisList = useRef();
	const setPage = (n, scroll = true) => {
		n = clampPage(n);
		if (pageSelectID && n !== pageFromUrl) DataStore.setUrlValue(pageSelectID, n);
		if (n === page) return;
		setPageRaw(n);

		// Scroll to top of list when switching pages - unless disabled with scrollOnPage=false
		if (scroll && scrollOnPage && thisList.current) thisList.current.scrollIntoView(true);
	};

	// Page number pulled from URL may be out-of-range when item list comes in - fix if so
	useEffect(() => {
		if (!items) return;
		if (page !== clampPage(page)) setPage(page, false);
	}, [pageCount]);

	// Initialise page URL value if absent? -- No, don't cram stuff into URL prematurely
	// if (items && pageSelectID && !pageFromUrl) setPage(1, false);

	const allItems = items; // Keep filtered but unpaginated list for e.g. CSV download
	if (pageSize) items = paginate({ items, page, pageSize });

	// more? NB: this thrashes the server for short sets of results?? Seen Apr 2024
	if (false && items && pageSize > allItems.length && list?.next) {
		let pvMore = getMoreDataList(list, getListParams, );
		isLoading = !pvMore.resolved; // loading...
	}

	// When list is retrieved (so run when items list changes size) check if we should switch page to show selected item
	useEffect(() => {
		if (pageFromUrl || !selected) return; // No selected = nothing to do; Don't override URL param
		const selFn = (typeof selected === 'function') ? selected : (itm => itm === selected); // can be predicate function or item
		if (items.find(selFn)) return; // Current page has it = nothing to do
		const itmIndex = allItems.findIndex(selected) + 1; // shift 0- to 1-indexed
		if (itmIndex > 0) setPage(Math.ceil(itmIndex / pageSize), false);
	}, [allItems.length]);

	// Generate the pagination links, if applicable
	const pageControls = <Pager setPage={setPage} current={page} pageCount={pageCount} />;

	// Static props common to all ListItemWrappers & ListItems
	const wrapperCommon = { type, servlet, navpage, unwrapped, checkboxes, canCopy, cannotClick, canDelete, notALink, itemClassName, onClickWrapper };
	const itemCommon = { type, servlet, navpage, nameFn, items: allItems, sort: DataStore.getValue(['misc', 'sort'])};

	// url for item? (used by ListItemWrapper)
	const dataspaceFromUrl = DataStore.getValue('location', 'path')[1];
	let getItemUrl = item => {
		const id = getId(item);
		let upath = [servlet, id];
		if (dataspace && dataspace === dataspaceFromUrl) {
			upath = [servlet, dataspace, id];
		}
		let itemUrl = modifyPage(upath, null, true)
		return itemUrl;
	};

	return (<div className={space('ListLoad', className, ListItem === DefaultListItem ? 'DefaultListLoad' : null)} >
		{canCreate && <CreateButton type={type} base={createBase} navpage={navpage} />}

		{canFilter && <PropControl inline label="Filter" size="sm" type="search" path={widgetPath} prop="filter" />}

		{!items.length && (noResults || <>No results found for <code>{space(q, filter) || type}</code></>)}

		{(total && !hideTotal) ? <div>
			{pageControls && `Showing ${1 + ((page - 1) * pageSize)} to ${Math.min(total, page * pageSize)} of `}
			{total} results{!pageControls && ' in total'}.</div> : null}
		{checkboxes && <MassActionToolbar type={type} canDelete={canDelete} items={items} />}
		{hasCsv && <ListLoadCSVDownload items={allItems} csvColumns={csvColumns} hideCsvColumns={hideCsvColumns} />}
		{pageControls}
		{items.map((item, i) => (
			<ListItemWrapper key={getId(item) || i} item={item} itemUrl={getItemUrl(item)} {...wrapperCommon} >
				<ListItem key={'li' + (getId(item) || i)} item={item} onClick={() => onClickItem(item)} {...itemCommon} />
			</ListItemWrapper>
		))}
		{pageControls}
		{isLoading && <Misc.Loading text={type.toLowerCase() + 's'} />}
		<ErrAlert error={error} />
	</div>);
} // ./ListLoad


/**
 * HACK offer a csv download
 * @param {*} param0 
 * @returns 
 */
function ListLoadCSVDownload({items, csvColumns, hideCsvColumns}) {
	if ( ! items.length) return null;
	if ( ! csvColumns) {
		csvColumns = Object.keys(items[0]);
	}
	if (hideCsvColumns) {
		csvColumns = csvColumns.filter(col => !hideCsvColumns.includes(col));
	}
	return <DownloadCSVLink data={items} columns={csvColumns} />;	
}


/**
 * 
 * @param {Object} p
 * @param {!Object[]} p.items Raw list of items
 * @param {!Number} p.page Page number to generate
 * @param {!Number} p.pageSize Size of pages
 * @returns {Object[]} slice of items
 */
const paginate = ({ items, page, pageSize }) => {
	assert(pageSize, 'paginate');
	return items.slice((page - 1) * pageSize, (page) * pageSize);
};


/**
 * TODO
 * @param {boolean} canDelete 
 */
function MassActionToolbar({ type, canDelete, items }) {
	// checked count
	let checkedPath = ['widget', 'ListLoad', type, 'checked'];
	let checked4id = DataStore.getValue(checkedPath);
	let checkCnt = 0; // TODO
	if (!checkCnt) return null; // TODO
	return (<div className="btn-toolbar" role="toolbar" aria-label="Toolbar for checked items">
		{checkCnt} checked of {items.length}
	</div>);
}

/**
 * Filter and resolve
 * @param {?Ref[]} hits 
 * @returns {Item[]}
 */
const resolveItems = ({ hits, type, status, preferStatus, filter, filterFn, transformFn, fastFilter }) => {
	if (!hits) {
		// an ajax call probably just hasn't loaded yet
		return [];
	}
	// resolve Refs to full Items
	hits = DataStore.resolveDataList(hits, preferStatus);
	// HACK: Use-case: you load published items. But the list allows for edits. Those edits need draft items. So copy pubs into draft
	if (preferStatus === KStatus.DRAFT) {
		hits.forEach(item => {
			let dpath = DataStore.getDataPath({ status: KStatus.DRAFT, type, id: getId(item) });
			let draft = DataStore.getValue(dpath);
			if (!yessy(draft)) {
				DataStore.setValue(dpath, item, false);
			}
		});
	}

	const items = [];
	const itemForId = {};

	// client-side filter and de-dupe
	// ...filterFn?
	if (filterFn) {
		hits = hits.filter(filterFn);
	}

	if (transformFn) {
		hits = transformFn(hits);
	}

	// ...string filter, dedupe, and ad
	if (!filter) fastFilter = false; // avoid pointless work in the loop
	const fastFilterStringify = JSON.stringify; // TODO allow user to override this
	hits.forEach(item => {
		// fast filter via stringify
		let sitem = null;
		if (fastFilter) {
			sitem = fastFilterStringify(item).toLowerCase();
			if (filter && sitem.indexOf(filter) === -1) {
				return; // filtered out
			}
		}
		// dupe?
		let id = getId(item) || sitem || JSON.stringify(item).toLowerCase();
		if (itemForId[id]) {
			return; // skip dupe
		}
		// ok
		items.push(item);
		itemForId[id] = item;
	});

	return items;
};


/**
 * 
 * @param {?Object} customParams - Not used! allows passing extra params through the click
 */
const onPick = ({ event, navpage, id, customParams }) => {
	stopEvent(event);
	modifyPage([navpage, id], customParams);
};


/**
 * checkbox, delete, on-click a wrapper
 */
function ListItemWrapper({ item, type, checkboxes, canCopy, cannotClick, list, canDelete, servlet, navpage, children, notALink, itemClassName, unwrapped, onClickWrapper, itemUrl }) {
	if (unwrapped) {
		return children;
	}
	const id = getId(item);
	if (!id) {
		console.error("ListLoad.jsx - " + type + " with no id", item);
		return null;
	}

	let checkedPath = ['widget', 'ListLoad', type, 'checked'];

	const checkbox = checkboxes ? (
		<div className="pull-left">
			<PropControl title="Select for mass actions" path={checkedPath} type="checkbox" prop={id} />
		</div>
	) : null;

	const hasButtons = canDelete || canCopy;

	// Item container element - clickable or not?
	const LinkOrDiv = (notALink || cannotClick) ? 'div' : A;
	const linkOrDivProps = { key: `item${id}`, className: itemClassName || space('ListItem btn-default btn btn-outline-secondary', `status-${item.status}`, hasButtons && 'btn-space') };
	if (!notALink) linkOrDivProps.href = itemUrl;
	if (!cannotClick) linkOrDivProps.onClick = event => onPick({event, navpage, id});
	if (!notALink && !cannotClick && onClickWrapper) linkOrDivProps.onClick = (event) => onClickWrapper(event, item);

	return (
		<div className="ListItemWrapper clearfix flex-row">
			{checkbox}
			<LinkOrDiv {...linkOrDivProps}>
				{children}
			</LinkOrDiv>
			{hasButtons && <div className="flex-column LL-buttons">
				{canDelete && <DefaultDelete type={type} id={id} />}
				{canCopy && <DefaultCopy type={type} id={id} item={item} list={list} onCopy={newId => onPick({ navpage, id: newId })} />}
			</div>}
		</div>
	);
}


/** Default item-to-logo component for DefaultListItem */
function DefaultLogoComponent({item}) {
	return <Misc.Thumbnail item={item} />;
};


/**
 * These can be clicked or control-clicked
 *
 * @param servlet
 * @param navpage -- How/why/when does this differ from servlet??
 * @param nameFn {Function} Is there a non-standard way to extract the item's display name?
 * 	TODO If it's of a data type which has getName(), default to that
 * @param extraDetail {Element} e.g. used on AdvertPage to add a marker to active ads
 */
function DefaultListItem({ type, item, LogoComponent = DefaultLogoComponent, checkboxes, canDelete, nameFn, extraDetail, button }) {
	const id = getId(item);
	// let checkedPath = ['widget', 'ListLoad', type, 'checked'];
	let name = nameFn ? nameFn(item, id) : item.name || item.text || id || '';
	if (name.length > 280) name = name.slice(0, 280);
	const status = item.status || "";

	return <>
		<LogoComponent item={item} />
		<div className="info text-left">
			<div className="name">{name}</div>
			<div className="detail small">
				id: <span className="id">{id}</span> <span className="status">{status.toLowerCase()}</span> {extraDetail} Created: <Misc.RoughDate date={item.created} /> {AThing.lastModified(item) && <>Modified: <Misc.RoughDate date={AThing.lastModified(item)} /></>}
			</div>
			{button || ''}
		</div>
	</>;
}

/**
 * Like DefaultListItem, but with less details unless dev/debug=dev
 */
 export function SimplePrettyListItem({ type, item, checkboxes, canDelete, nameFn, extraDetail, button }) {
	const id = getId(item);
	// let checkedPath = ['widget', 'ListLoad', type, 'checked'];
	let name = nameFn ? nameFn(item, id) : item.name || item.text || id || '';
	if (name.length > 280) name = name.slice(0, 280);
	const status = item.status || "";
	return <>
		<Misc.Thumbnail item={item} />
		<div className="info text-left">
			<div className="name">{name}</div>
			{item.desc && <small>{ellipsize(item.desc, 140)}</small>}
			{Roles.isDev() && <div className="detail small">
				id: <span className="id">{id}</span> <span className="status">{status.toLowerCase()}</span> {extraDetail} Created: <Misc.RoughDate date={item.created} /> {AThing.lastModified(item) && <>Modified: <Misc.RoughDate date={AThing.lastModified(item)} /></>}
			</div>}
			{button || ''}
		</div>
	</>;
}

function DefaultDelete({ type, id }) {
	return (
		<Button color="outline-danger" size="xs" className="pull-right p-1 pt-2 ml-2"
			onClick={e => confirm(`Delete this ${type}?`) && ActionMan.delete(type, id)}
			title="Delete">
			<Icon name="trashcan" />
		</Button>);
}


/**
 * 
 * @param {?Function} p.onCopy newId -> any Respond to the new item e.g. by opening an editor
 * @returns 
 */
function DefaultCopy({ type, id, item, list, onCopy }) {
	let [isCopying, setIsCopying] = useState();

	const doCopy = () => {
		let ok = confirm(`Copy this ${type}?`);
		if (!ok) return;
		setIsCopying(true);
		// loads the item if needed
		let pvItem = getDataItem({ type, id, status: getStatus(item) || KStatus.ALL_BAR_TRASH });
		pvItem.promise.then(p => {
			saveAs({ type, oldId: id })
				.promise.then(newItem => {
					setIsCopying(false);
					// ?? show the item in the list - saveAs should invalidate the list though with the same effect
					// if (list && list.hits) {
					// 	let i = Math.max(list.hits.indexOf(item), 0);
					// 	list.hits.splice(i, 0, newItem);
					// 	DataStore.update();
					// }
					// navigate to the new item
					if (onCopy && getId(newItem)) {
						onCopy(getId(newItem));
					}
				});
		});
	};

	return (<Button color="outline-secondary" size="xs" className="pull-right p-1 pt-2 ml-2"
		disabled={isCopying}
		onClick={e => stopEvent(e) && doCopy()}
		title="Copy">
		{isCopying ? <Icon name="hourglass" /> : <Icon name="copy" />}
	</Button>);
}

/**
 * lowercase and no punctuation, as users type names, but want invariance against details
 * @param {!string} id 
 * @returns {!string}
 */
export const id2canonical = id => id.toLowerCase().replace('&', "and").replace(/[^a-zA-Z0-9]/g,'-');

/**
 * Make a local blank, and set the nav url
 * Does not save (Crud will probably do that once you make an edit) unless a `saveFn` or `then` is passed in to do so
 * @param {Object} p
 * @param {!String} p.type C.TYPES
 * @param {?Object} p.base - use to make the blank. This will be copied.
 * @param {?String} p.id This will have spaces replaced with "-"s
 * @param {?Function} p.make use to make the blank. base -> item. If unset, look for a DataClass for type, and use `new` constructor. Or just {}.
 * @param {?Function} p.saveFn {type, id, item} eg saveDraftFn
 * @param {?Function} p.then {type, id, item} Defaults to `onPick` which navigates to the item. Set this to switch off navigation.
 * @param {?Function} p.toCanonical id:string -> string Defaults to lowercase and no punctuation. Can be a custom function or falsy for no canonicalisation.
 */
const createBlank = ({ type, navpage, base, id, toCanonical=id2canonical, make, saveFn, then }) => {
	assert(!getId(base), "ListLoad - createBlank - ID not allowed (could be an object reuse bug) " + type + ". Safety hack: Pass in an id param instead");
	// Call the make?
	let newItem;
	if (make) {
		newItem = make(base);
	} else {
		const klass = getClass(type);
		if (klass) {
			const cons = klass.bind({}); // NB: need the bind otherwise `this` is undefined
			newItem = cons(base); // equivalent to `new Thing(base)` -- probably the normal way to do things
			if (klass._name) newItem['@type'] = klass._name;	// NB: dont forget the DataClass type, which is lost by the bind
		}
	}
	if (!newItem) newItem = Object.assign({}, base);
	// specify the id?
	if (id) {
		// ...canon, as users type names
		const canonId = toCanonical? toCanonical(id) : id;
		newItem.id = canonId;
		// ...and set the name for the same reason
		if ( ! newItem.name) newItem.name = id;
	}
	// make an id? (make() might have done it)
	if (!getId(newItem)) {
		newItem.id = nonce(8);
	}
	id = getId(newItem);

	// Mark the new item as DIRTY - i.e. "not matching copy on server", because it doesn't exist there yet.
	DataStore.setLocalEditsStatus(type, id, C.STATUS.dirty, false);

	if (!getType(newItem)) newItem['@type'] = type;
	// poke the new blank into DataStore
	newItem.status = KStatus.DRAFT;
	const path = DataStore.getDataPath({ status: KStatus.DRAFT, type, id });
	DataStore.setValue(path, newItem);
	if (saveFn) {
		saveFn({ type, id, item: newItem });
	}
	if (then) {
		then({ type, id, item: newItem });
	} else {
		// set the id
		if (!navpage) {
			navpage = DataStore.getValue('location', 'path')[0]; //type.toLowerCase();
		}
		onPick({ navpage, id });
	}
	// invalidate lists
	DataStore.invalidateList(type);
};


/**
 * A create-new button. This does NOT save the newly created object (unless a save function is passed in as `then`).
 * @param {Object} p
 * @param {!String} p.type
 * @param {?JSX} p.children Normally null (defaults to "+ Create"). If set, this provides the button text contents
 * @param {?String} p.navpage - defaults to the curent page from url
 * @param {?String} p.id - Optional id for the new item (otherwise nonce or a prop might be used)
 * @param {?string[]} p.props - keys of extra props -- this is turned into a form for the user to enter
 * @param {?Function} p.saveFn {type, id, item} eg saveDraftFn Deprecated - prefer `then`
 * @param {?Function} p.then {type, id, item} Defaults to `onPick` which navigates to the item.
 */
function CreateButton({type, props, navpage, base, id, make, saveFn, then, children, className, disabled}) {
	assert(type);
	assert(!base || !base.id, "ListLoad - dont pass in base.id (defence against object reuse bugs) " + type + ". You can use top-level `id` instead.");
	if (!navpage) navpage = DataStore.getValue('location', 'path')[0];
	// merge any form props into the base
	const cpath = ['widget', 'CreateButton'];
	base = Object.assign({}, base, DataStore.getValue(cpath));
	// was an ID passed in by editor props? (to avoid copy accidents id is not used from base, so to use it here we must fish it out)
	if (!id) id = base.id; // usually null
	delete base.id; // NB: this is a copy - the original base is not affected.
	if ( ! children) {
		children = <><span style={{fontSize:'125%', lineHeight:'1em'}}>+</span> Create</>;
	}
	const $createButton = <Button disabled={disabled} className={space('btn-create', className)} 
		onClick={() => createBlank({type,navpage,base,id,make,saveFn,then})} >{children}</Button>;
	if ( ! props) {
		// simple button
		return $createButton;
	}
	// mini form
	return (<Card><CardBody><Form inline>
		{props.map(prop => <PropControl key={prop} label={prop} prop={prop} path={cpath} inline className="mr-2" />)}
		{$createButton}
	</Form></CardBody></Card>);
}

export { CreateButton, DefaultListItem, createBlank, DefaultDelete, DefaultCopy };
export default ListLoad;
