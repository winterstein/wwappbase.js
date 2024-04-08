import React, { useEffect, useState } from 'react';
import { Input, InputGroup } from 'reactstrap';
import { is } from '../../utils/miscutils';
import { asDate, getTimeZone, setTimeZone } from '../../utils/date-utils';
import Misc from '../Misc';

import PropControl, { fakeEvent, FormControl, registerControl } from '../PropControl';
import DataStore from '../../plumbing/DataStore';

// TODO use Intl.supportedValuesOf("timeZone") but filter down to a small set, one per offset??
const hardcodedTimezones = 'UTC Europe/London Australia/Sydney America/New_York America/Los_Angeles'.split(' ');

/**
 * 
 * @param {Object} p 
 * @returns 
 */
function PropControlTimezone2({type, prop, value, dflt, label, help, placeholder, saveFn, onChange, ...stuff}) {
	// HACK show default setting TODO make this work in PropControlSelect
	if (prop==="tz" && ! dflt) {
		dflt = getTimeZone();
	}
	// NB onChange is a default passed in by PropControl - ignore it
	const saveFn2 = ({path, prop, value, event}) => {
		if (prop==="tz" && value) {
			setTimeZone(value);
		}
		if (saveFn) saveFn({path, prop, value, event});
	};
	return (<div>
		<PropControl type="select" {...stuff}
			prop={prop}
			options={[getTimeZone()].concat(hardcodedTimezones)}
			saveFn={saveFn2}
			dflt={dflt}
		/>
	</div>);
}

registerControl({type: 'timezone', $Widget: PropControlTimezone2});

/**
 * @param {PropControlParams} p 
 */
function PropControlTimezone({prop="tz", ...p}) {
	return <PropControl type="timezone" prop={prop} {...p} />;
}

export default PropControlTimezone;
