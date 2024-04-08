
import React from 'react';
import { space } from '../../base/utils/miscutils';

/**
 * Because: css sucks
 */
 const Center = ({children}) => {
	const centering = {display:"flex",alignItems:"center",justifyContent:"center"};
	return <div style={centering}>{children}</div>;
};

export default Center;
