import React, { useState, useEffect } from 'react';

import { Alert, Card, CardBody, Nav, Button, NavItem, NavLink } from 'reactstrap';

import { assert, assMatch } from '../utils/assert';

import JSend from '../data/JSend';

import DataStore from '../plumbing/DataStore';

/**
 * A button that you can only click once, until it clears.
 * 
 * @param {Object} p
 * @param {?Object[]} p.formData
 * @param {?String[]} p.path DataStore path to the form-data to submit. Set this OR formData
 * @param {Boolean} p.once If set, this button can only be clicked once.
 * @param {?Function} p.onClick If set (eg instead of `url`), call this with ({data})
 * @param {?Boolean|string} p.confirmSubmit If set, show a confirm dialog
 * @param responsePath {?String[]} If set, the (JSend unwrapped) response data will be set in DataStore here.
 * @param onSuccess {JSX} TODO rename this! shown after a successful submit. This is not a function to call!
 */
const SubmitButton = ({formData, path, url, responsePath, once, color='primary', className, onSuccess, onClick,
	title='Submit the form', children, size, disabled, confirmSubmit}) => 
{
	assert(typeof url === 'string' || onClick instanceof Function, "Need submit url or onClick");
	// assMatch(path, 'String[]');
	// track the submit request
	const [submitStatus, setSubmitStatus] = useState();
	// const tpath = ['transient','SubmitButton'].concat(path);
	if ( ! formData && path) formData = DataStore.getValue(path);
	// DataStore.setValue(tpath, C.STATUS.loading);
	const params = {
		data: formData
	};
	const doSubmit = e => {
		if (confirmSubmit) {
			let msg = _.isString(confirmSubmit)? confirmSubmit : "Are you sure?";
			let ok = confirm(msg);
			if ( ! ok) return;
		}
		setSubmitStatus(C.STATUS.saving);
		if (onClick) {
			onClick(params);
			setSubmitStatus(C.STATUS.clean);
		}
		if (url) {
			ServerIO.load(url, params)
				.then(res => {
					setSubmitStatus(C.STATUS.clean);
					if (responsePath) {
						const resdata = JSend.data(res);
						DataStore.setValue(responsePath, resdata);
					}
				}, err => {
					setSubmitStatus(C.STATUS.dirty);
				});
		}
	};

	// let localStatus = DataStore.getValue(tpath);
	// show the success message instead?
	if (onSuccess && C.STATUS.isclean(submitStatus)) {
		return onSuccess;
	}
	let isSaving = C.STATUS.issaving(submitStatus);
	const vis = {visibility: isSaving? 'visible' : 'hidden'};
	let isDisabled = !! (disabled || isSaving || (once && submitStatus));
	if (isDisabled && ! disabled) {
		title = isSaving? "Saving..." : "Submitted :) To avoid errors, you cannot re-submit this form";
	}

	return (
		<Button onClick={doSubmit} size={size} color={color} className={className} disabled={isDisabled} title={title}>
			{children || title}
			<span style={vis}> ...</span>
			{/* <Icon name="spinner" className="spinning" style={vis} /> */}
		</Button>
	);
};

export default SubmitButton;