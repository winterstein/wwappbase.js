import React, { useEffect, useState } from 'react';
import { Input, InputGroup } from 'reactstrap';
import { countryListAlpha2 } from '../../data/CountryRegion';

import PropControl, { fakeEvent, registerControl } from '../PropControl';
import PropControlSelection from './PropControlSelection';

/**
 * See PersonLite.java
 */
const PropControlPerson = ({path, prop, proppath, storeValue, onChange, warnOnUnpublished}) => {
	return (<InputGroup>
		<PropControl type="text" prop='name' path={proppath} label />
		<PropControl type="imgUpload" prop='img' path={proppath} label="Portrait photo" />
	</InputGroup>);
};

registerControl({type: 'person', $Widget: PropControlPerson});

export default {};
