

import React, { useState } from 'react';

import Autocomplete from 'react-autocomplete';
import PromiseValue from '../promise-value';

import DataStore from '../plumbing/DataStore';
import { getType, getId } from '../data/DataClass';
import PropControl, { registerControl, DSsetValue } from './PropControl';

import { str } from '../utils/assert';



/** Use Bootstrap components to make the dropdown menu look nice by default*/
const renderMenuDflt = (items, value, style) => <div className="dropdown-menu show">{items}</div>;
const renderItemDflt = (itm) => <div key={""+itm} className="dropdown-item">{itm}</div>


/**
 * case insensitive string contains test
 * @param {string|Object} itm 
 * @param {?string} value 
 */
const shouldItemRenderDflt = (itm, value) => str(itm).toLowerCase().startsWith((value || '').toLowerCase());


/**
 * @deprecated DO NOT USE WITHOUT OVERHAULING: depends on react-autocomplete which is 4 years abandoned and a dependency nightmare.
 * wraps the reactjs autocomplete widget
 * TODO When options is a function, default to "show all items"
 * @param {Function|Object[]|String[]} options The items to select from
 * @param {?JSX} renderItem Should return a Bootstrap DropdownItem, to look nice. Will be passed a member of the options prop as its only argument.
 * @param {?Function} getItemValue Map item (member of options prop) to the value which should be stored
*/
const PropControlAutocomplete = ({ prop, storeValue, value, rawValue, setRawValue, options, getItemValue = (s => s),
	renderItem = renderItemDflt, path, proppath, bg, saveFn, modelValueFromInput = (s => s), shouldItemRender = shouldItemRenderDflt,
	...otherStuff }) => 
{
	// a place to store the working state of this widget. Minor TODO refactot to useState
	let widgetPath = ['widget', 'autocomplete'].concat(path);
	const type = 'autocomplete';
	const items = _.isArray(options) ? options : DataStore.getValue(widgetPath) || [];

	if (!rawValue) rawValue = value;

	// NB: typing sends e = an event, clicking an autocomplete sends e = a value
	const onChange2 = (e) => {
		// typing sends an event, clicking an autocomplete sends a value
		const val = e.target ? e.target.value : e;
		setRawValue(val)
		let mv = modelValueFromInput(val, type, e, storeValue);
		DSsetValue(proppath, mv);
		if (saveFn) saveFn({ event: e, path: path, prop, value: mv });
		// e.preventDefault();
		// e.stopPropagation();
	};

	const onChange = (e, optItem) => {
		onChange2(e, optItem);
		if (!e.target.value) return;
		if (!_.isFunction(options)) return;
		let optionsOutput = options(e.target.value);
		let pvo = new PromiseValue(optionsOutput);
		pvo.promise.then(oo => {
			DataStore.setValue(widgetPath, oo);
			// also save the info in data
			// NB: assumes we use status:published for auto-complete
			oo.forEach(opt => {
				if (getType(opt) && getId(opt)) {
					const optPath = DataStore.getDataPath({ status: C.KStatus.PUBLISHED, type: getType(opt), id: getId(opt) });
					DataStore.setValue(optPath, opt);
				}
			});
		});
		// NB: no action on fail - the user just doesn't get autocomplete
	};

	return (
		<Autocomplete
			inputProps={{ className: otherStuff.className || 'form-control' }}
			getItemValue={getItemValue}
			items={items}
			renderMenu={renderMenuDflt}
			renderItem={renderItem}
			value={rawValue || ''}
			onChange={onChange}
			onSelect={onChange2}
			shouldItemRender={shouldItemRender}
			menuStyle={{zIndex: 1}}
		/>
	);
}; //./autocomplete

registerControl({type:'autocomplete', $Widget: PropControlAutocomplete});

export default PropControlAutocomplete;
