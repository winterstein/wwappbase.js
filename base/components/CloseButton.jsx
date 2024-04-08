
import React from 'react';
import { space } from '../utils/miscutils';

/**
 * A BS close button (TODO - BS v5 support) 
 * @param {Object} p
 * @param {!Function} p.onClick
 * @param {?String} p.size sm|lg
 */
const CloseButton = ({className, style, onClick, size, color, tooltip}) => {
	return (<button type="button" className={space(className,"close",color && "bg-"+color, size&&"btn-"+size)} 
		aria-label="Close" style={style}
		onClick={onClick} title={tooltip}><span aria-hidden="true">&times;</span></button>);
};

export default CloseButton;
