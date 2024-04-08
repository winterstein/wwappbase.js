import React, { useState } from 'react';
import { Input, InputGroup } from 'reactstrap';
import { countryListAlpha2 } from '../../data/CountryRegion';

import PropControl, { fakeEvent, registerControl } from '../PropControl';
import PropControlSelection from './PropControlSelection';

/**
 * See SimplePlace.java and IPlace.java
 */
const PropControlPlace = ({path, prop, proppath, storeValue, onChange, warnOnUnpublished}) => {
	// Use controlled inputs so their state is in-scope here - but don't bind them directly to DataStore
	const [name, setName] = useState(storeValue?.name);

	// When the inputs change, synthesise an input-change event to pass up to PropControl and DataStore
	const _onChange = e => {
		setName(e.target.value);
		const newVal = { ...storeValue };
		newVal.name = name;
		// newVal.country = country;
		onChange({...fakeEvent, target: { value: newVal }});
	};

	return (<InputGroup>
		<Input type="text" name={`${prop}-name`} value={name} onChange={_onChange} />
		<PropControlCountry prop="country" storeValue={storeValue} path={proppath} onChange={_onChange} warnOnUnpublished={warnOnUnpublished} />
	</InputGroup>);
};


const PropControlCountry = ({path, prop}) => {
	const options = Object.keys(countryListAlpha2);
	const labels = Object.values(countryListAlpha2);
	return <PropControl type="select" path={path} prop={prop} options={options} labels={labels} />;
};


registerControl({type: 'place', $Widget: PropControlPlace});
registerControl({type: 'country', $Widget: PropControlCountry});

export default {};
