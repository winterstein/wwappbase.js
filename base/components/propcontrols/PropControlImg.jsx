import React from 'react';

import { FormControl, registerControl } from '../PropControl';
import { urlValidator } from './validators';
import Misc from '../Misc';



const PropControlImg = ({prop, storeValue, onChange, bg, ...rest}) => (
	<div>
		<FormControl type="url" name={prop} value={storeValue} onChange={onChange} onBlur={onChange} {...rest} />
		{storeValue && <div className="pull-right" style={{ background: bg, padding: bg ? '20px' : '0' }}><Misc.ImgThumbnail url={storeValue} background={bg} /></div>}
		<div className="clearfix" />
	</div>
);


registerControl({
	type: 'img',
	$Widget: PropControlImg,
	validator: urlValidator
});

export default {};
