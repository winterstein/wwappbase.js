import React, { useState } from 'react';
import { yessy } from '../utils/miscutils';

/**
 * Optionally wrap the contents in a div.
 * Use-case: When there might be a need for a wrapper div to take some props. But maybe not. 
 * To avoid "polluting" the dom with unnecessary divs.
 * 
 */
const Wrap = ({children, ...props}) => {
	if ( ! children) return null;
	if ( ! yessy(props)) return children;
	return <div {...props}>{children}</div>;
};

export default Wrap;
