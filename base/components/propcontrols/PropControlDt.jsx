import React, { useEffect, useState } from 'react';
import { Input, InputGroup } from 'reactstrap';

import PropControl, { FakeEvent, fakeEvent, registerControl } from '../PropControl';

// See TUnit
const label4TUnit = {MILLISECOND: 'msec', SECOND: 'seconds', MINUTE: 'minutes', HOUR: 'hours', DAY: 'days', WEEK: 'weeks', MONTH: 'months', YEAR: 'years'};

/**
 * See Dt.java - this control bundles two inputs (numeric for count, drop-down for unit) into a time-duration editor.
 */
const PropControlDt2 = ({prop, storeValue, onChange, unitOptions = Object.keys(label4TUnit)}) => {
	// The combination of useEffect, useState and onChange created an inifinite loop. Not sure why. Fixed with guards. May 2023.
	// ??Would using PropControls for the two bits of the DT be more robust??

	// is storeValue never null??	
	// Use controlled inputs so their state is in-scope here - but don't bind them directly to DataStore
	const [nVal, setNVal] = useState(storeValue.n);
	// Default to unit=SECOND if available
	const [unitVal, setUnitVal] = useState(storeValue.unit || (() => unitOptions.find(a => a === 'SECOND') ? 'SECOND' : unitOptions[0]));

	// Detect local changes and send to store
	useEffect(() => {
		console.log("useEffect DT 1", nVal, unitVal);
		if (nVal === storeValue.n && unitVal === storeValue.unit) return; // don't fire unnecessarily
		_onChange();
	}, [nVal || "undef", unitVal]);

	// Detect store changes and update local
	useEffect(() => {
		console.log("useEffect DT 2", storeValue.n, storeValue.unit);
		if (nVal === storeValue.n && unitVal === storeValue.unit) return; // don't fire unnecessarily
		setNVal(storeValue.n);
		if (storeValue.unit) setUnitVal(storeValue.unit); // the if () guard stops a loop bug, seen May 2023
	}, [storeValue.n, storeValue.unit]);

	// When the inputs change, synthesise an input-change event to pass up to PropControl and DataStore
	const _onChange = () => {
		const newVal = { ...storeValue };
		newVal.n = nVal;
		if (unitVal) newVal.unit = unitVal; // the if () guard stops a loop bug, seen May 2023
		onChange(new FakeEvent(newVal));
	};

	// Disable the dropdown (but keep it present) if there's only one option
	const unitDisable = unitOptions.length <= 1;

	const onChangeUnit = (e) => { 
		setUnitVal(e.target.value); 
	};

	return <InputGroup>
		<Input type="number" name={`${prop}-n`} value={nVal} onChange={(e) => { setNVal(e.target.value); }} />
		<Input type="select" name={`${prop}-unit`} value={unitVal} onChange={onChangeUnit} disabled={unitDisable}>
			{unitOptions.map(option => <option key={option} value={option}>{label4TUnit[option] || option}</option>)}
		</Input>
	</InputGroup>;
};


registerControl({type: 'dt', $Widget: PropControlDt2});


/**
 * See Dt.java - this control bundles two inputs (numeric for count, drop-down for unit) into a time-duration editor.
 * @param {PropControlParams} p 
 */
function PropControlDt(p) {
	return <PropControl type="dt" {...p} />;
}

export default PropControlDt;
