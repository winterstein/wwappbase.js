import React, { useEffect, useState } from 'react';
import { Input, InputGroup } from 'reactstrap';
import { debounce } from 'lodash';

import PropControl, { registerControl } from '../PropControl';



export interface RangeSliderProps {
	min: number;
	max: number;
	step?: number;
	defaultValue: number;
	onChange?: (event: Event) => void;
}


function PropControlRange2({ min, max, step, storeValue, onChange: onChangeRaw, onChangeInstant, saveFn, ...props }): JSX.Element {
	// Sliders generate lots of events per second - rather than spamming DataStore, hold value locally & debounce DS updates
	const [value, setValue] = useState(storeValue);
	const [commitFn] = useState(() => debounce(onChangeRaw, 1000)); // debounced function must persist across renders to work

	const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setValue(parseFloat(event.target.value)); // update local
		if (onChangeInstant) onChangeInstant(event);
		commitFn(event); // debounced updates to DataStore
	};

	// Position the value bubble: How far over (proportionally) is the slider?
	const fraction = (value - min) / (max - min);
	const bubbleStyle = (fraction < 0.8) ? (
		{ left: `${fraction * 100}%` }
	) : (
		{ right: `${(1-fraction) * 100}%` }
	);

	// Type safety
	let shownValue = Number.parseFloat(value);

	return <InputGroup>
		<Input type="range" min={min} max={max} step={step} value={shownValue} onChange={onChange} />
		<div className="value-bubble-container">
			<span className="value-bubble" style={bubbleStyle}>{shownValue?.toPrecision(4)} g</span>
		</div>
	</InputGroup>;
};


registerControl({type: 'range', $Widget: PropControlRange2});


/**
 * Generates an <input type="range"> slider.
 * @param {PropControlParams} p
 * @param {Number} p.min Minimum (left) value
 * @param {Number} p.max Maximum (right) value
 * @param {Number} p.step Increment of change when sliding
 * @param {Function} p.onChangeInstant Will receive un-debounced updates
 */
function PropControlRange(props: Object) {
	return <PropControl type="range" {...props} />;
}


export default PropControlRange;
