import React, { useState } from 'react';
import { encURI } from '../utils/miscutils';
import LinkOut from './LinkOut';

/**
 * A mailto tag for emails you can click on
 * 
 * TODO support for setting email subject
 */
const MailTo = ({email, children}) => {
	if (!email) return children;
	// TODO check email is an email
	return <a href={"mailto:"+encURI(email)}>{children || email}</a>;
};

export default MailTo;
