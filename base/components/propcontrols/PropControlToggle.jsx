import React, { useEffect } from 'react';
import { Label, Button } from 'reactstrap';
import { space } from '../../utils/miscutils';

import { DSsetValue, registerControl } from '../PropControl';


// Default option setup for a yes/no button.
const dfltLeft = { colour: 'secondary', label: 'No', value: false }; // NB: the red 'danger' colour was a bit too alarming for "off"
const dfltRight = { colour: 'success', label: 'Yes', value: true };
const fixBool = {yes: 'true', no: 'false'};


/**
* 2-value toggle switch. Defaults to "No/Yes" --> false/true
* @param {Object} props
* @param {Object} props.left {colour, value, label}
* @param {?String} props.left.colour Bootstrap colour class shown when left option is active
* @param {?String} props.left.label Text for left option label
* @param {*} props.left.value Value to store when left option selected
* @param {Object} props.right {colour, value, label}
*/
const PropControlToggle = ({ path, prop, value, saveFn, left = {}, right = {}}) => {
	// Fill out options with defaults
	left = {...dfltLeft, ...left}; 
	right = {...dfltRight, ...right};

	const fullPath = path.concat(prop);

	// Try to fix bad values on first render
	useEffect(() => {
		if (value === left.value || value === right.value) return; // Type & value good!
		console.log("PropControlToggle - value not one of specified options!", prop, "value:", value, left.value, right.value);
		// Everything else we can do relies on toString
		if (!value?.toString) return;
		let vString = value.toString().toLowerCase();
		const lString = left.value.toString().toLowerCase();
		const rString = right.value.toString().toLowerCase();
		// If we convert all values to string, does value match either option?
		let coercedValue = value;
		if (vString === lString) coercedValue = left.value;
		else if (vString === rString) coercedValue = right.value;
		else if (vString in fixBool) {
			// Reproduce old yesNo behaviour: coerce 'yes'/'no' to 'true'/'false' and try again
			coercedValue = fixBool[vString];
			if (vString === lString) coercedValue = left.value;
			else if (vString === rString) coercedValue = right.value;
		}
		// Any success? Update if we found a better value.
		if (coercedValue !== value) DSsetValue(fullPath, coercedValue);
	}, fullPath);

	// Shift the switch to either side to signify state - or leave in the centre if it doesn't match either
	let shiftClass = 'ml-2 mr-2';
	let btnColour = 'default';
	let badgeContent = '\u00A0'; //&nbsp;
	if (value === left.value || ! value) { // treat unset as No (as falsy logic is standard)
		shiftClass = 'mr-3';
		btnColour = left.colour;
	} else if (value === right.value) {
		shiftClass = 'ml-3';
		btnColour = right.colour;
	} else {
		badgeContent = '?';
	}

	// Flip undefined-->right, left-->right, right-->left
	const toggle = () => {
		let nextValue = right.value;
		if (value === right.value) nextValue = left.value;
		DSsetValue(fullPath, nextValue);
		if (saveFn) saveFn({ path, prop, value: nextValue });
	};

	return <>
			<Label check>{left?.label || 'No'}</Label>
			<span className={`toggle-switch btn btn-xs inset ml-1 mr-1 btn-${btnColour}`} onClick={toggle}>
				<Button size="xs" color="default" className={shiftClass}>{badgeContent}</Button>
			</span>
			<Label check>{right?.label || 'Yes'}</Label>
	</>;
};


registerControl({type: 'yesNo', $Widget: PropControlToggle}); // deprecated in favour of toggle
registerControl({type: 'toggle', $Widget: PropControlToggle});

export default {};
