/**
 * 
 * TODO refactor other select_options-from-a-list controls from PropControl into here
 * 
 */


import React, { useState } from 'react';
import PropControl, {registerControl, DSsetValue} from '../PropControl';
import DataStore from '../../plumbing/DataStore';
import { Badge, Form, FormGroup, Input, Label } from 'reactstrap';
import CloseButton from '../CloseButton';
import { asArray, labeller } from '../../utils/miscutils';
import { assert } from '../../utils/assert';


// TODO refactor select -- but with care around onChange() and existing uses
// /**
//  * @param options {any[]} Will be de-duped.
//  * @param labels {?String[]|Function|Object} Map options to nice strings
//  * @param multiple {?boolean} If true, this is a multi-select which handles arrays of values.
//  * @param {?Boolean} canUnset If true, always offer an unset choice.
//  */
// function PropControlSelect2({ options, labels, storeValue, value, rawValue, setRawValue, multiple, prop, onChange, saveFn, canUnset, inline, size, ...otherStuff }) {
// 	// NB inline does nothing here?
// 	// NB: pull off internal attributes so the select is happy with rest
// 	const { className, recursing, modelValueFromInput, label, ...rest } = otherStuff;
// 	assert(options, 'PropControl: no options for select ' + [prop, otherStuff]);
// 	assert(options.map, 'PropControl: options not an array ' + options);
// 	options = _.uniq(options);
// 	const labelFn = labeller(options, labels);

// 	// Multi-select is a usability mess, so we use a row of checkboxes.
// 	if (multiple) {
// 		return PropControlMultiSelect({ storeValue, value, rawValue, setRawValue, prop, onChange, labelFn, options, size, className, modelValueFromInput, ...rest });
// 	}

// 	// make the options html
// 	const domOptions = options.map((option, index) => {
// 		// The big IAB Taxonomy dropdown has some dupe names which are used as options
// 		// - so permit a keys list, separate from the option strings, to differentiate them
// 		const thisKey = 'option_' + ((otherStuff.keys && otherStuff.keys[index]) || JSON.stringify(option));
// 		return <option key={thisKey} value={option} >{labelFn(option)}</option>;
// 	});
// 	const showUnset = (canUnset || !storeValue) && !options.includes(null) && !options.includes('');

// 	/* text-muted is for my-loop mirror card
// 	** so that unknown values are grayed out TODO do this in the my-loop DigitalMirrorCard.jsx perhaps via labeller or via css */
// 	const safeValue = storeValue || ''; // "correct usage" - controlled selects shouldn't have null/undef value
// 	return (
// 		<select className={space('form-control', size && "form-control-"+size, className)}
// 			name={prop} value={safeValue} onChange={onChange}
// 			{...rest}
// 		>
// 			{showUnset ? <option></option> : null}
// 			{domOptions}
// 		</select>
// 	);
// }
// registerControl({type:'select', $Widget: PropControlSelect2});


/**
 * @param {Object} p
 * @param {String[]} p.value
 * @param {Object[]} p.options 
 * @param {String[] | Function | Object} p.labels Optional value-to-string convertor.
 */
function PropControlCheckboxes({rawValue, storeValue, setRawValue, modelValueFromInput, path, prop, proppath, type, 
	options, labels, tooltips, inline, fcolor, saveFn, disabled}) 
{
	assert(options, `PropControl: no options for radio ${prop}`);
	assert(options.map, `PropControl: radio options for ${prop} not an array: ${options}`);

	const listValue = asArray(storeValue);

	// Make an option -> nice label function
	// the labels prop can be a map or a function
	let labelFn = labeller(options, labels);
	let tooltipFn = tooltips && labeller(options, tooltips);

	// convert value to String[] for checkboxes
	const onChange = e => {
		console.log("onchange", e); // minor TODO DataStore.onchange recognise and handle events
		const val = e && e.target && e.target.value;			
		// toggle on/off
		let newList;
		if (listValue.includes(val)) {
			newList = listValue.filter(v => v !== val);
		} else {
			newList = listValue.concat(val);
		}
		let newList2 = modelValueFromInput? modelValueFromInput(newList, type, e) : newList;
		DSsetValue(proppath, newList2); // Debugging no-visual-update bug Apr 2022: tried update=true here -- no change :(
		setTimeout(() => DataStore.update(), 1); // HACK for no-visual-update bug May 2022 on testmy.gl
		if (saveFn) saveFn({ event: e, path, prop, value: newList2});		
	};
	const isChecked = x => listValue.includes(x);
	return <Checkboxes {...{options, inline, prop, isChecked, onChange, labelFn, tooltipFn, disabled}} />;
} // ./radio

registerControl({type:'checkboxes', $Widget: PropControlCheckboxes});
registerControl({type:'checkboxArray', $Widget: PropControlCheckboxes}); // how does this differ from checkboxes??

/**
 * 
 * @param {Object} p
 */
const Checkboxes = ({options, inline, prop, isChecked, onChange, labelFn, tooltipFn, disabled}) => options.map(option => (
	<FormGroup check inline={inline} key={option} title={tooltipFn && tooltipFn(option)}>
		<Input type="checkbox" key={`option_${option}`}
			disabled={disabled}
			className="form-check-input"
			name={prop} value={option}
			checked={!!isChecked(option)}
			onChange={onChange} id={option}
		/>
		<Label check for={option}>
			{labelFn(option)}
		</Label>
	</FormGroup>
));


/**
 * @param {Object} p
 * @param {{String:Boolean}} p.value
 * @param {String[] | Function | Object} p.labels Optional value-to-string convertor.
 */
const PropControlCheckboxObject = ({rawValue, storeValue, setRawValue, modelValueFromInput, path, prop, proppath, type, options, labels, tooltips, inline, fcolor, saveFn}) => {
	assert(options, `PropControl: no options for ${prop}`);
	assert(options.map, `PropControl: options for ${prop} not an array: ${options}`);

	const objValue = storeValue || {};

	// Make an option -> nice label function
	// the labels prop can be a map or a function
	let labelFn = labeller(options, labels);
	let tooltipFn = tooltips && labeller(options, tooltips);

	// convert value to String[] for checkboxes
	const onChange = e => {
		const val = e && e.target && e.target.value;			
		// toggle on/off
		objValue[val] = ! objValue[val];
		DSsetValue(proppath, objValue, true);
		if (saveFn) saveFn({ event: e, path, prop, value: objValue});
	};
	const isChecked = x => objValue[x];

	return <Checkboxes {...{options, inline, prop, isChecked, onChange, labelFn, tooltipFn}} />;
};
registerControl({type:'checkboxObject', $Widget: PropControlCheckboxObject});

// This is not really for use
const PropControlSelection = PropControlCheckboxes;
export default PropControlSelection;

