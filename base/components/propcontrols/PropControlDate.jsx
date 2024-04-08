import React, { useEffect, useState } from 'react';
import { Input, InputGroup } from 'reactstrap';
import { is, stopEvent } from '../../utils/miscutils';
import { asDate, dayEndTZ, isoDate, isoDateTZ } from '../../utils/date-utils';

import PropControl, { fakeEvent, FormControl, registerControl } from '../PropControl';
import { dayStartTZ } from '../../utils/date-utils';
import { newDateTZ } from '../../utils/date-utils';

/**
 * This is for dates only. It is timezone aware. Note: `date` vs `datetime-local`
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/datetime-local
 * 
 * @param {Object} p 
 * @param {string} p.time start|end|none start/end of day, or "none" for no-time (date part only, timezone logic off)
 * NB: we like sending full timestamps for clarity around timezone issues
 * @returns 
 */
function PropControlDate2({ path, prop, type, storeValue, rawValue, setRawValue, value, onChange, saveFn, set, time, min, max, title, ...otherStuff }) {
	// Roll back to native editor on 27/04/2022
	// The bug that caused us to use the custom text editor was from 2017 https://github.com/winterstein/sogive-app/issues/71 & 72
	// I don't think it will happen again, but it's worth keeping in mind.
	// console.log("rawValue", rawValue);
	if ( ! is(rawValue) && storeValue) {
		rawValue = isoDateTZ(storeValue);
	}

	// Strip out the time part
	rawValue = noTimePart(rawValue);

	// NB: ignore "value" if it has been sent through -- if it has a time-part the widget would show blank. rawValue is what we use.

	// HACK end day = start next day, so display day-1 in the widget
	if (rawValue && "end"===time) {
		let d = new Date(rawValue);
		d.setDate(d.getDate() - 1);
		rawValue = isoDate(d);
	}

	// replace the default onChange to use full-iso-date-time (rather than just the date part). timezone aware
	const onChangeDate = e => {
		stopEvent(e);
		const etv = e.target.value;		
		setRawValue(etv);
		let mv = null;
		if (etv) {
			if (etv.match(/\d{4}-\d{2}-\d{2}/)) {
				// iso format!
				mv = etv;
			} else {
				try {
					let date;
					if ("none" === time) {
						date = new Date(etv);
					// 	mv = etv; // No time wanted? value should be yyyy-mm-dd already, so no need to mess around with timezone
					} else if (time) {				
						date = "end"===time? dayEndTZ(date) : dayStartTZ(date); // start/end of day
					} else {
						date = newDateTZ(etv); // normal
					}
					// HACK convert date to UK
					if (navigator.language==="en-GB") {
						
					}
					mv = date.toISOString();
				} catch(err) { // done by validator?
					mv = null;			
				}
			}
		}
		console.log("onChangeDate",etv,"mv",mv);
		set(mv);
		if (saveFn) saveFn({ event: e, path, prop, value: mv });	
		// }, 250, etv);
	};

	let minDate = min? isoDateTZ(min) : undefined;
	let maxDate = max? isoDateTZ(max) : undefined;

	if ( ! title && rawValue) title = new Date(rawValue).toLocaleDateString(navigator.language, {dateStyle: 'full'});

	// Use a text input so people can type (fixes the bug where 20xx dates were impossible to type in)
	// And append a date-picker via a native date input
	return <FormControl type="text" name={prop} value={rawValue} onChange={onChangeDate} title={title} {...otherStuff} 
				append={<input id="datePicker" value={noTimePart(storeValue)} type="date" 
					style={{border:"none",color:"transparent",width:"1.4rem"}} 
					onChange={onChangeDate} min={minDate} max={maxDate} />}
			/>;		
}

/**
 * Strip time-part if present (because date widgets won't display it)
 * @param {?string} s 
 * @returns {?string}
 */
const noTimePart = s => {
	if ( ! s || ! s.includes("T")) return s;
	try {
		s = isoDateTZ(new Date(s));
	} catch(err) {
		console.log(err); // rawValue is allowed to be bogus
	}
	return s;
};


/**
 * Note: `date` vs `datetime-local`
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/datetime-local
 * 
 * @param {Object} p 
 * @returns 
 */
function PropControlDateTime2({ prop, type, storeValue, rawValue, onChange, set, ...otherStuff }) {
	// Roll back to native editor on 27/04/2022
	// The bug caused us to use the custom text editor was from 2017 https://github.com/winterstein/sogive-app/issues/71 & 72
	// I don't think it will happen again, but it's worth keeping in mind.
	if ( ! is(rawValue) && storeValue) {
		rawValue = asDate(storeValue).toISOString();
	}

	return (<div>
		<FormControl type="datetime-local" name={prop} value={rawValue} onChange={onChange} {...otherStuff} />
	</div>);
}

const dateValidator = ({value, rawValue, props}) => {
	if (!value) {
		// raw but no date suggests the server removed it
		if (rawValue) {
			return 'Please use the date format yyyy-mm-dd';
		}
		return null;
	}
	try {
		let sdate = '' + new Date(value);
		if (sdate === 'Invalid Date') {
			return 'Invalid Date - Please use the date format yyyy-mm-dd';
		}
	} catch (er) {
		return 'Please use the date format yyyy-mm-dd';
	}
};

registerControl({type: 'date', $Widget: PropControlDate2, validator:dateValidator});

registerControl({ type: 'datetime', $Widget: PropControlDateTime2 });
registerControl({ type: 'datetime-local', $Widget: PropControlDateTime2 });

/**
 * @param {PropControlParams} p 
 */
function PropControlDate(p) {
	return <PropControl type="date" {...p} />;
}

export default PropControlDate;
