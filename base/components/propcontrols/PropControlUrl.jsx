import React from 'react';

import { FormControl, registerControl } from '../PropControl';
import { urlValidator } from './validators';


// TODO Big similarities between url, img and uploader types - more code reuse?
const PropControlUrl = ({https, prop, value, storeValue, label, set, ...rest}) => (
	// ??why pass ...rest into the control?? WHat are the use-cases??
	<div>
		<FormControl type="url" name={prop} value={storeValue} onBlur={rest.onChange} {...rest} />
		<div className="pull-right"><small>{value ? <a href={value} target="_blank">open in a new tab</a> : null}</small></div>
		<div className="clearfix" />
	</div>
);


registerControl({
	type: 'url',
	$Widget: PropControlUrl,
	validator: urlValidator
});

export default {};
