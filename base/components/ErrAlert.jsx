import React, { useState } from 'react';

import { Button, Card, CardBody, Form, Alert } from 'reactstrap';
import { isDev } from '../Roles';
import { space } from '../utils/miscutils';
import CloseButton from './CloseButton';

/**
 * Show an error as a BS alert.
 * @param {Object} p
 * @param {Error|Response|string} [p.error] If error is falsy, show nothing.
 * @param {string} [p.color] =danger (red) by default. Options: danger|warning|info
 * @param {boolean} [p.canClose]
 * @param {?JSX} [p.children] Optional - extra widgets, e.g. a CTA for this error
 */
const ErrAlert =({error,color,canClose,children}) => {
	if ( ! error) return null;
	const [closed,setClosed] = useState();
	if (closed) return null; // fade out??
	// NB: error.text is used by You-Again Login.error. error.message is used by JSend
	let emsg = _.isString(error)? error : space(error.status, error.statusText, error.message || error.text);		
	let edetails = space(error.id, error.responseText, error.details, error.stack);	
	if ( ! emsg) {
		console.warn("ErrAlert - blank?",error);
		return null;
	}
	// strip details if sent by our servers
	emsg = emsg.replace(/<details>[\s\S]*<\/details>/, "").trim();
	return <Alert color={color||'danger'}>
		{emsg}
		{children}
		{isDev() && edetails && <p><small>Dev details: {edetails}</small></p>}
		{canClose && <CloseButton onClick={e => setClosed(true)} />}
	</Alert>;
};
export default ErrAlert;
