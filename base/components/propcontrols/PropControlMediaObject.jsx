import React, { useEffect, useState } from 'react';
import { Input, InputGroup } from 'reactstrap';
import { countryListAlpha2 } from '../../data/CountryRegion';

import PropControl, { fakeEvent, registerControl } from '../PropControl';
import PropControlSelection from './PropControlSelection';
import SubCard from '../SubCard';
import PropControlPerson from './PropControlPerson';
const dummy = PropControlPerson;

function PropControlMediaObject({path, prop, proppath, uploadType, storeValue, onChange, warnOnUnpublished}) {
	return (<>
		<PropControl type={uploadType} prop="contentUrl" path={proppath} />
		<PropControl type="text" prop="caption" path={proppath} label size="sm" />
	</>);
}

/**
 * See ImageObject.java
 */
function PropControlImageObject(props) {
	return <PropControlMediaObject uploadType="imgUpload" {...props} />;
}

/**
 * See VideoObject.java
 */
function PropControlVideoObject(props) {
	return <PropControlMediaObject uploadType="videoUpload" {...props} />;
}

registerControl({type: 'ImageObject', $Widget: PropControlImageObject});
registerControl({type: 'VideoObject', $Widget: PropControlVideoObject});

export default {};
