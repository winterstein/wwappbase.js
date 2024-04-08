import React, { useEffect, useState } from 'react';
import { Input, InputGroup } from 'reactstrap';
import { countryListAlpha2 } from '../../data/CountryRegion';

import PropControl, { fakeEvent, registerControl } from '../PropControl';
import SubCard from '../SubCard';
import PropControlPerson from './PropControlPerson';
const dummy = PropControlPerson;

/**
 * See Quotation.java
 */
const PropControlQuotation = ({path, prop, proppath, storeValue, onChange, warnOnUnpublished}) => {
	return (<SubCard className={"position-relative"}>
		<span style={{fontSize:"300%", position:"absolute", top:0, left:0}} >&ldquo;</span>
		<span style={{fontSize:"300%", position:"absolute", bottom:0, right:0}} >&rdquo;</span>
		<PropControl type="textarea" prop='text' path={proppath} label />
		<PropControl type="videoUpload" prop='video' path={proppath} label="Video testimonial" />
		<PropControl type="person" prop='author' path={proppath} label />
		<PropControl type="date" prop='created' path={proppath} label="Date" />
	</SubCard>);
};

registerControl({type: 'quotation', $Widget: PropControlQuotation});

export default {};
