
import React, { useEffect, useState } from 'react';
import { Input, Button, ButtonGroup, FormGroup } from 'reactstrap';
import { cloneDeep } from 'lodash';

import ListLoad, { CreateButton } from '../ListLoad';

import PropControl, { PropControlParams, registerControl } from '../PropControl';
import { getDataItem } from '../../plumbing/Crud';
import { getId } from '../../data/DataClass';
import { encURI } from '../../utils/miscutils';
import {saveDraftFnFactory} from '../SavePublishDeleteEtc';
import { A } from '../../plumbing/glrouter';
import DataItemBadge from '../DataItemBadge';
import KStatus from '../../data/KStatus';



/**
 * A picker with auto-complete for e.g. Advertiser, Agency
 * @param {Object} p
 * @param {!String} p.itemType
 * @param {?Object} p.base Used with canCreate, a base object for if a new item is created.
 * @param {?boolean} p.canCreate Offer a create button
 * @param {?String} p.createProp If a new item is created -- what property should the typed value set? Defaults to "id"
 * @param {?String} p.status Defaulst to PUB_OR_DRAFT
 * @param {?String} p.q Optional search query (user input will add to this). Usually unset.
 * @param {?String} p.list Optional list to use (instead of querying the server). Usually unset.
 * @param {?Boolean} p.embed If true, set a copy of the data-item. By default, what gets set is the ID.
 */
function Select({children, canCreate, createProp = 'id', base, path, prop, proppath, rawValue,
	set, setRawValue, storeValue, modelValueFromInput,
	type, itemType, status=KStatus.PUB_OR_DRAFT, domain, list, q, sort, embed, pageSize=20, navpage, notALink, readOnly, showId=true,
}) {
	const [showLL, setShowLL] = useState(); // Show/hide ListLoad
	const [, setCloseTimeout] = useState(); // Debounce hiding the ListLoad
	const [inputClean, setInputClean] = useState(true); // Has the user input anything since last pick?

	// What's the ID stored at the bound DataStore path? Extract from embedded object if necessary.
	const storeId = embed ? getId(storeValue) : storeValue;

	// If storeValue is edited from elsewhere, propagate change to rawValue.
	useEffect(() => {
		if (storeId === rawValue) return;
		setRawValue(storeId || '');
		// If external edit is an existing DataItem ID, it can be considered selected. (If it's not, this has no effect.)
		setInputClean(true);
	}, [storeValue]);

	// In React pre-v17, onFocus/onBlur events bubble - BUT:
	// When focus shifts WITHIN the listener, a blur/focus event pair is fired.
	// (In React 17+, onFocus/onBlur uses native onFocusIn/onFocusOut,
	// which bubbles and does NOT fire on internal-focus-shift.)
	// So when a blur event fires, wait a moment before closing the dropdown list
	// in case another focus event arrives.
	const onFocus = () => {
		setCloseTimeout(prevTimeout => {
			window.clearTimeout(prevTimeout);
			return null;
		});
		setShowLL(true);
	};

	const onBlur = () => {
		setCloseTimeout(prevTimeout => {
			 // Never have two delayed-close timeouts active at the same time
			window.clearTimeout(prevTimeout);
			return window.setTimeout(() => setShowLL(false), 200);
		});
	};

	const onChange = e => {
		let id = e.target.value;
		setRawValue(id);
		// signal "user is typing, don't replace search box with item badge, even if this is a valid ID"
		// NB: This fixes an issue where if "a" was a valid ID then you couldn't enter "apple"
		setInputClean(false);
	};

	// Select a DataItem from the dropdown list & make it the accepted value of this PropControl
	const doSet = item => {
		const id = getId(item); // NB: this will be trimmed as it came from an item
		setRawValue(id);
		let mv = embed ? cloneDeep(item) : id;
		if (modelValueFromInput) mv = modelValueFromInput(mv, type, {}, storeValue);
		// DSsetValue(proppath, mv, true);
		set(mv);
		setShowLL(false); // hide ListLoad
		setInputClean(true); // signal OK to replace search box with item badge
	};

	// Action for a click on the X button next to a selected item
	const doClear = () => {
		setRawValue('');
		set(null);
	};

	// Do we have a candidate data-item?
	const itemId = rawValue || storeId;
	let dataItem = null;
	if (embed && storeValue) {
		// data-item is stored whole at path+prop
		dataItem = storeValue;
	} else if (itemId) {
		// attempt to fetch data-item
		dataItem = getDataItem({ type: itemType, id: itemId, status, domain, swallow: true }).value;
	}

	// (default create behaviour) the input names the object
	if (rawValue && createProp) {
		if (!base) base = {};
		base[createProp] = rawValue;
	}
	const baseId = base && base.id;
	if (baseId) delete base.id; // manage CreateButton's defences

	// If the user has entered something in the search box, and it happens to be a valid ID -
	// don't replace the search box with the item badge until they select it in the dropdown!
	const showItem = dataItem && inputClean;
	// Offer to create an item with name = current input value
	const showCreate = !dataItem && canCreate && rawValue;

	return (
		<div className="data-item-control" onFocus={onFocus} onBlur={onBlur}>
			{showItem ? <>
				<ButtonGroup>
					<Button color="secondary" className="preview" tag={notALink ? 'span' : A}
						href={!notALink ? `/#${(navpage||itemType.toLowerCase())}/${encURI(getId(dataItem))}` : undefined}
						title={!notALink ? `Switch to editing this ${itemType}` : undefined}
					>
						<SlimListItem type={itemType} item={dataItem} noClick />
					</Button>
					{!readOnly && <Button color="secondary" className="clear" onClick={doClear}>🗙</Button>}
				</ButtonGroup>
				{showId && <div><small>ID: <code>{itemId}</code></small></div>}
			</> : <>
				<FormGroup className="dropdown-sizer">
					<Input type="text" value={itemId} onChange={onChange} />
					{rawValue && showLL && <div className="items-dropdown card card-body">
						<ListLoad hideTotal type={itemType} status={status}
							domain={domain}
							filter={rawValue}
							filterFn={item => !item.redirect /* avoid deprecated redirect objects */}
							unwrapped sort={sort}
							ListItem={SlimListItem}
							// TODO allow ListLoad to show if there are only a few options
							noResults={`No ${itemType} found for "${rawValue}"`}
							pageSize={pageSize} 
							otherParams={{filterByShares:true}} // deprecated: filterByShares Dec 2022
							onClickItem={item => doSet(item)}
							q={q}
							list={list}
							scrollOnPage={false}
						/>
					</div>}
					{showCreate && <CreateButton
						type={itemType} base={base} id={baseId} className="ml-1"
						saveFn={saveDraftFnFactory({type, key: prop})} then={({item}) => doSet(item)}
					/>}
				</FormGroup>
			</>}
		</div>
	);
}

export function Option({value, }) {
	return <div></div>
};

Select.Option = Option;

export default Select;
