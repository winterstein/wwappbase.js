/** PropControl provides inputs linked to DataStore.
 */
import React, { useRef, useState, useEffect } from 'react';

// TODO refactor so saveFn is only called at the end of an edit, e.g. on-blur or return or submit

// TODO Maybe add support for user-set-this, to separate user-cleared-blanks from initial-blanks

// BE CAREFUL HERE
// These controls are used in multiple projects, and they have to handle a range of cases.

// FormControl removed in favour of basic <inputs> as that helped with input lag
// TODO remove the rest of these
import { Row, Col, Form, Button, Input, Label, FormGroup, InputGroup, InputGroupAddon, InputGroupText, Popover, PopoverBody, Modal, ModalBody, PopoverHeader, Table, Badge } from 'reactstrap';
import _ from 'lodash';
import Enum from 'easy-enums';

import { assert, assMatch } from '../utils/assert';
import JSend from '../data/JSend';
import { stopEvent, toTitleCase, space, labeller, is, ellipsize, noVal } from '../utils/miscutils';

import { getDataItem } from '../plumbing/Crud';
import KStatus from '../data/KStatus';

import Misc, { CopyToClipboardButton } from './Misc';
import DataStore from '../plumbing/DataStore';
import Icon from './Icon';
import { luminanceFromHex } from './Colour';
import DataClass, { nonce } from '../data/DataClass';

import { countryListAlpha2 } from '../data/CountryRegion';

import PropControl_PopUpButton from './propcontrols/PropControl_PopUpButton';
import PropControl_Modal from './propcontrols/PropControl_Modal';


/**
 * Set the value and the modified flag in DataStore.
 * Convenience for DataStore.setModified() + DataStore.setValue()
 * @param {!String[]} proppath
 * @param value
 * @returns value
 */
export const DSsetValue = (proppath, value, update) => {
	DataStore.setModified(proppath);
	return DataStore.setValue(proppath, value, update);
	// console.log("set",proppath,value,DataStore.getValue(proppath));
};


/** Default validator for date values */
const dateValidator = (val, rawValue) => {
	if (!val) {
		// raw but no date suggests the server removed it
		if (rawValue) return 'Please use the date format yyyy-mm-dd';
		return null;
	}
	try {
		let sdate = '' + new Date(val);
		if (sdate === 'Invalid Date') {
			return 'Please use the date format yyyy-mm-dd';
		}
	} catch (er) {
		return 'Please use the date format yyyy-mm-dd';
	}
};


/** Use Bootstrap popover to display help text on click */
export function Help({ children, icon = <Icon name="info" />, color = 'primary', className, ...props }) {
	const [id] = useState(() => `help-${nonce()}`); // Prefixed because HTML ID must begin with a letter
	const [open, setOpen] = useState(false);
	const toggle = () => setOpen(!open);

	return <>
		<a id={id} className={space(className, `text-${color}`)} {...props}>{icon}</a>
		<Popover target={id} trigger="legacy" placement="auto" isOpen={open} toggle={toggle}>
			<PopoverBody>
				{children}
			</PopoverBody>
		</Popover>
	</>;
}


/**
 * Define a class for useful VS Code editor help
 */
export class PropControlParams {
	/** 
	 * @type {?Function} 
	 * inputs: `{path, prop, value, event}` 
	 * * This gets called at the end of onChange.
	* You are advised to wrap this with e.g. _.debounce(myfn, 500).
	* NB: we cant debounce here, cos it'd be a different debounce fn each time.
	* Save utils:
	* SavePublishDeleteEtc `saveDraftFn` 
	* or instead of saveFn, place a SavePublishDeleteEtc on the page.
	 *
	 * Relationship to `set`: Called just after set(), and with extra inputs.
	 * `saveFn` adds to the basic DataStore update normally done by set.
	*/
	saveFn;

	/** @type {?string|boolean} As a convenience for a common case: if true, use the prop with title-case */
	label;

	/** @type {?string} */
	type

	/** 
	 * @type {string[]} The DataStore path to item, e.g. [data, NGO, id].
	 * 	Default: ['location','params'] which codes for the url
	 */
	path = ['location', 'params'];


	/** @type {!string} The field being edited */
	prop;

	/** @type {?Object} default value (this will get set over-riding a null/undefined/'' value in the item) 
	 * NB: "default" is a reserved word, hence the truncated spelling. 
	 * This CANNOT change from unset to set or React will get upset (with the error "Rendered more hooks than during the previous render.")
	 */
	dflt;

	/** @type {?Function} inputs: (value, type, event) See standardModelValueFromInput. */
	modelValueFromInput;

	/** @type {?Function} inputs `{path, prop, value, event}` */
	onPause;

	/** @type {?Number} use with `onPause`. Milliseconds to wait. */
	pauseTime = 1000;

	/** @type {?boolean} If set, this field should be filled in before a form submit. 
	 * TODO mark that somehow visually
	*/
	required;

	/** @type {?Function} {?(value, rawValue) => String} Generate an error message if invalid */
	validator;

	/** @type {?String} Error message to show, regardless of validator output */
	error

	/** @type {?boolean} If set, this is an inline form, so add some spacing to the label. */
	inline;

	/** @type {?boolean} if true, for type=url, urls must use https not http (recommended) */
	https;

	/** @type {?boolean} if true optimise React updates and renders. Only use for busting bottlenecks.
	// 	Warning: when coupled with other controls, this can cause issues, as the other controls won't always update. 
	// 	E.g. if a fast text input has an associated button. */
	fast;

	/** @type {?boolean} */
	readOnly;

	/** 
	 * @type {?Function} (newItem) => () Called when a new value is entered.
	 * If unset, uses DataStore via DSsetValue().
	 * If set, it replaces this -- allowing use of useState or custom handling.
	 * 
	 * Warning:Not all controls support this yet!
	 * 
	 * Relationship to `saveFn`: Called just before saveFn(), and with just the new-value as input.
	 */
	set;

	/** @type {?Function} (storeValue,rawValue) => ?string error message */
	validator;

	/** Optional pass in of the current value */
	value;

	/** @type {?string} Warning message to show, regardless of validator output */
	warning

	/**
	 * @type {boolean} If true (the default) show a "Not Published Yet" warning if an edit to a published object is in draft only
	 */
	warnOnUnpublished = true;

	/** @type {?Object} */
	left

	/** @type {?Object} */
	right
}; // ./PropControlParams


// Positive, negative, BigInt 0, and boolean false
const falsyToRetain = { 0: true, [-0]: true, [0n]: true, false: true };

/** Collapse emptyish values like null, undefined, [], {}, "" to null - but keep "meaningful" ones */
const collapseEmpty = val => {
	if (val?.length === 0) return null;
	if (falsyToRetain[val]) return val;
	if (typeof val === 'object' && JSON.stringify(val) === '{}') return null;
	return val || null;
}


/**
 * Check part of a DataItem for difference between DRAFT and PUBLISHED versions.
 * @param {String[]} path Path to DataItem OR object inside it
 * @param {String} prop Final path element (structured like this for convenience with PropControl)
 * @returns {?Object} null for no item / not draft / no difference,
 * { status: 'DRAFT' } for draft-only,
 * { status: 'MODIFIED', pubVal: '...', draftVal: '.....' } if different from published.
 */
const diffProp = (path, prop) => {
	if (!path || path.length < 3) return null; // Must be a DataItem or part of one
	const [status, type, id] = path || [];
	if (!status || status !== 'draft') return null; // Must be a draft
	if (!type || type==="User" || type==="USER") return null; // Ignore USER type, no need for login props

	// Make sure both versions of the item are available locally
	let pvDraft = getDataItem({ type, id, status: KStatus.DRAFT, swallow: true });
	let pvPub = getDataItem({ type, id, status: KStatus.PUBLISHED, swallow: true });

	// If the draft doesn't exist it can't have unpublished changes.
	if (!pvDraft.value) return null;

	// Never been published? It's ALL unpublished changes!
	if (!pvPub.value) return { status: KStatus.DRAFT };

	// OK, so what's the actual difference for this prop?
	let draftVal = DataStore.getValue([...path, prop]);
	let pubVal = DataStore.getValue(['data', ...path.slice(1), prop]); // "data", not "published"
	// NB We don't care about the difference between nully/empty/falsy things - besides 0 and false
	draftVal = collapseEmpty(draftVal);
	pubVal = collapseEmpty(pubVal);
	// No difference? (Cheap identity / implicit string-comparison check)
	if (draftVal === pubVal) return null;
	// No difference? (More expensive deep-compare)
	if (_.isEqual(draftVal, pubVal)) return null;

	return { status: KStatus.MODIFIED, pubVal, draftVal };
};


/** Longhand string representation of a value for disambiguating diffs. */
const diffStringify = val => {
	// Anything with explicitly defined toString should use it...
	if (val?.hasOwnProperty('toString')) return val.toString();
	// Stringify kills the [Object object] problem & explicitly differentiates e.g. 123 vs "123"
	return JSON.stringify(val);
}


/**
 * Show a black and yellow marker badge + popover detailing differences if a PropControl's value is different from the published version.
 * @param {props.path}
 * @param {props.prop}
 * @param {props.className}
 * @returns 
 */
function DiffWarning({path, prop, className}) {
	const diff = diffProp(path, prop);
	if (!diff) return null;
	// Don't spew visual noise on every PropControl for an unpublished item
	// TODO Should we mark this anyway?
	if (KStatus.isDRAFT(diff.status)) return null;

	const [showPopover, setShowPopover] = useState(false);
	const [id] = useState(() => `diff-${nonce()}`);
	const popoverId = `${id}-popover`;
	const toggle = () => {
		// TODO Pull this out and have a SelfClosingPopover element
		if (!showPopover) {
			const maybeHidePopover = (e) => {
				const popoverEl = document.getElementById(popoverId);
				if (!popoverEl) return; // never got created due to error?
				if (popoverEl.contains(e.target)) return;
				setShowPopover(false);
				document.body.removeEventListener('click', maybeHidePopover);
			};
			document.body.addEventListener('click', maybeHidePopover);
		}
		setShowPopover(!showPopover);
	};

	// This processing could get expensive, don't do it if the popover is closed
	let pBody = null;
	if (showPopover) {
		const pubValStr = diffStringify(diff.pubVal);
		const draftValStr = diffStringify(diff.draftVal);
		const pubValShort = ellipsize(pubValStr, 100);
		const draftValShort = ellipsize(draftValStr, 100);
		let checkClipboardWarning = (pubValShort === draftValShort) ? (
			' (Differences outside this excerpt - use clipboard button to inspect)'
		) : '';

		const doRevert = () => DataStore.setValue(path.concat(prop), diff.pubVal);

		pBody = <PopoverBody>
			<div className="diff-line mb-1">
				<strong>Pub</strong>
				<code className="diff-val mx-1" title={pubValShort + checkClipboardWarning}>{pubValShort}</code>
				<CopyToClipboardButton size="sm" text={pubValStr} />
			</div>
			<div className="diff-line">
				<strong>Edit</strong>
				<code className="diff-val mx-1" title={draftValShort + checkClipboardWarning}>{draftValShort}</code>
				<CopyToClipboardButton size="sm" text={draftValStr} />
			</div>
			<Button size="sm" color="warning" className="mt-1 w-100" onClick={doRevert}>Revert to published version</Button>
		</PopoverBody>;
	}

	return <>
		<Button id={id} className={space('data-modified', className)} onClick={toggle} title="Unpublished edits, click to see difference" />
		<Popover id={popoverId} isOpen={showPopover} toggle={toggle} target={id} className="data-modified-details">
			<PopoverHeader>Unpublished edit</PopoverHeader>
			{pBody}
		</Popover>
	</>;
}




/**
 * Input bound to DataStore.
 * 
 * NB: PropControl or Input + useState?
 * PropControl is best if the data is shared with other components,
 *   or if the data should be maintained across page changes (which might destroy and recreate the widget),
 *   or if extras like help and error text are wanted.
 * useState is best for purely local state.
 * 
 * NB: This function provides a label / help / error wrapper -- then passes to PropControl2
 * @param {PropControlParams} p
 */
const PropControl = ({ className, warnOnUnpublished = true, ...props }) => {
	let { type, optional, required, path, prop, set, label, help, tooltip, customIcon, error, warning, validator, inline, dflt, fast, size, int, ...stuff } = props;
	if (label === true) {
		label = toTitleCase(prop); // convenience
		props = { ...props, label };
	}
	// If path not given, link it to a URL param by default
	if (!path) {
		path = ['location', 'params'];
		props = { ...props, path };
	}
	// Type defaults to "text" (intentionally done here instead of using destructure-default)
	if (!type) {
		type = 'text';
		props = { ...props, type };
	}

	assert(PropControl.KControlType.has(type), `PropControl: invalid type ${type}`);
	assert(prop || prop === 0 || set, `PropControl: invalid prop for path: "${path}", prop: "${prop}"`); // NB 0 is valid as an array entry
	if (prop) assMatch(prop, 'String|Number', `PropControl: prop must be string or number, path: "${path}", prop: "${prop}"`);
	assMatch(path, Array, `PropControl: path is not an array: "${path}", prop: "${prop}"`);
	assert(path.indexOf(undefined) < 0 && path.indexOf(null) < 0, `PropControl: nully in path "${path}", prop: "${prop}"`);

	// value comes from DataStore
	let pvalue = props.value; // Hack: preserve value parameter for checkboxes
	const proppath = path.concat(prop);
	// TODO refactor to use `storeValue` in preference to `value` as it is unambiguous
	// HACK: for now, we use both as theres a lot of code that refers to value, but its fiddly to update it all)
	let storeValue = set? pvalue : DataStore.getValue(proppath);
	let value = storeValue; // TODO remove `value`

	// What is rawValue?
	// It is the value as typed by the user. This allows the user to move between invalid values, by keeping a copy of their raw input.
	// NB: Most PropControl types ignore rawValue. Those that use it should display rawValue.
	// Warning: rawValue === undefined/null means "use storeValue". BUT rawValue === "" means "show a blank"
	const [rawValue, _setRawValue] = useState(_.isString(storeValue) ? storeValue : null);
	const [dirty, setDirty] = useState();
	const setRawValue = x => { // debug!
		setDirty(true);
		_setRawValue(x);
	};
	assMatch(rawValue, "?String", `PropControl: rawValue must be a string, path: "${path}", prop: "${prop}" type: "${type}""`);
	// Reset raw value if code outside the PropControl changes the value
	const [oldStoreValue, setOldStoreValue] = useState(storeValue);
	if (oldStoreValue !== storeValue && ! dirty) {
		// HACK: Have to be careful e.g. PropControlMoney changes the object as you type. TODO an updating state flag to handle this properly
		// (Date in PropControlPeriod will return undefined in DataClass.str(), but we still want to let it through)
		if (DataClass.str(oldStoreValue) !== DataClass.str(storeValue) || (DataClass.str(oldStoreValue) === undefined && DataClass.str(storeValue) == undefined)) {
			setRawValue(_.isString(storeValue) ? storeValue : null);
			setOldStoreValue(storeValue);
		}
	}

	// old code
	if (props.onChange) {
		console.warn(`PropControl: ${path}.${prop} s/onChange/saveFn/ as onChange is set internally by PropControl`);
		props = Object.assign({ saveFn: props.onChange }, props);
		delete props.onChange;
	}
	// act only after a pause? Useful to avoid spamming the backend. Similar to onBlur.
	if (props.onPause) {
		useEffect(() => {
			if (storeValue == oldStoreValue) return;
			const timeOutId = setTimeout(() => {
				props.onPause({path, prop, value:storeValue});
			}, props.pauseTime || 1000);
			return () => clearTimeout(timeOutId);
		}, [storeValue]);
	}

	// On first render, replace empty-ish values (ie not explicit false or 0) with default, if given.
	// Don't refactor this to useEffect - we want storeValue and value changed in-flow as well
	const [firstRender, setFirstRender] = useState(true);
	if (firstRender && dflt !== undefined) {
		if (noVal(storeValue) || storeValue === '') {
			storeValue = dflt;
			value = dflt;
			// Are we setting a url value? If so don't break the back button
			// This is handled in DataStore itself - see setValue() -- but should it be handled here instead?
			setTimeout(() => DataStore.setValue(proppath, dflt)); // Defer in timeout to avoid "update during render" warnings
		}
		setTimeout(() => setFirstRender(false));
	}

	if (required && (noVal(storeValue) || storeValue === '' || (storeValue.length && storeValue.length == 0))) {
		className += " missing-required";
	}

	// Temporary hybrid form while transitioning to all-modular PropControl structure where registerControl() sets validatorForType
	// newValidator produces an object compatible with setInputStatus
	// ...but isn't used if a validator is explicitly supplied by caller.
	// TODO Allow validator to output error and warning simultaneously?
	// TODO Allow validator to output multiple errors / warnings?
	const newValidator = validator ? null : validatorForType[type];

	/** @type {JSend} */
	let validatorStatus;

	// validate!
	if (newValidator) { // safe to override with this if it exists as it won't override explicit validator in props
		validatorStatus = newValidator({ value: storeValue, rawValue, props });
		if (typeof(validatorStatus) === 'string') { // convert string to JSend?
			validatorStatus = { status: 'warning', message:validatorStatus };
		}
	} else if (validator) {
		const tempError = validator(storeValue, rawValue);
		if (tempError) validatorStatus = { status: 'error', message: tempError };
	}

	// Has an issue been reported?
	// TODO refactor so validators and callers use setInputStatus
	if (!error) {
		const inputStatus = getInputStatus(proppath);
		if (!inputStatus && required && storeValue === undefined) {
			setInputStatus({ path: proppath, status: 'error', message: 'Missing required input' });
		}
		if (inputStatus && inputStatus.status === 'error') {
			error = inputStatus.message || 'Error';
		}
	}

	// if it had an error because the input was required but not filled, remove the error once it is filled
	// TODO Expand inputStatus system so we can explicitly mark some standard error types like "required but empty"?
	if (error) {
		const is = getInputStatus(proppath);
		if (is && is.status === 'error' && required && storeValue) {
			setInputStatus(null);
			error = undefined;
		}
	}

	// Prefer validator output, if present, over caller-supplied errors and warnings
	// TODO Is this correct?
	if (validatorStatus) {
		if (validatorStatus.status === 'error') error = validatorStatus.message;
		if (validatorStatus.status === 'warning') warning = validatorStatus.message;
	}

	// Hack: Checkbox has a different html layout :( -- handled below
	const isCheck = PropControl.KControlType.ischeckbox(type); // || PropControl.KControlType.isradio(type);

	// Minor TODO help block id and aria-described-by property in the input
	const labelText = label || '';
	let helpIcon = tooltip ? <Icon name="info" title={tooltip} /> : '';

	// Mark as required or explicitly-optional?
	let optreq = null;
	if (optional) {
		optreq = <small className="text-muted">optional</small>
	} else if (required) {
		optreq = <small className={storeValue === undefined ? 'text-danger' : null}>*</small>
	}

	// Add option to pop the control out in a <Modal> on focus
	if (props.modal) return <PropControl_Modal WrappedComponent={PropControl} className={className} {...props} />

	// Add button to create a popup window containing a floating copy of the PropControl
	let popupButton;
	if (props.popup) {
		const buttonProps = {...props, className, storeValue, setValue: value => DataStore.setValue(proppath, value)};
		popupButton = <PropControl_PopUpButton {...buttonProps} />;
	}

	const diffWarning = warnOnUnpublished && <DiffWarning path={path} prop={prop} className="ml-1" />;

	// NB: pass in recursing error to avoid an infinite loop with the date error handling above.
	// let props2 = Object.assign({}, props);
	// Hm -- do we need this?? the recursing flag might do the trick. delete props2.label; delete props2.help; delete props2.tooltip; delete props2.error;
	// type={type} path={path} prop={prop} error={error} {...stuff} recursing
	const sizeClass = { sm: 'small', lg: 'large' }[props.size]; // map BS input size to text-size
	// NB: label has mr-1 to give a bit of spacing when used in an inline form
	// NB: reactstrap inline is buggy (Sep 2020) so using className
	// ??Include a css class for styling or hacky code?? "control-"+prop,
	// focus?? see https://blog.danieljohnson.io/react-ref-autofocus/
	return (
		<FormGroup check={isCheck}
			className={space(type, className, inline && !isCheck && 'form-inline', error && 'has-error')} 
			size={size} 
		>
			{(label || tooltip) && !isCheck &&
				<label className={space(sizeClass, 'mr-1')} htmlFor={stuff.name}>{labelText} {helpIcon} {optreq}</label>}
			{inline && ' '}
			{help && !inline && !isCheck && <Help>{help}</Help>}
			{customIcon}
			{!isCheck && diffWarning}
			{popupButton}
			<PropControl2 storeValue={storeValue} value={value} rawValue={rawValue} setRawValue={setRawValue} proppath={proppath} {...props} pvalue={pvalue} />
			{inline && ' '}
			{isCheck && diffWarning}
			{help && (inline || isCheck) && <Help>{help}</Help>}
			{error && <span className="help-block text-danger data-error">{error}</span>}
			{warning && <span className="help-block text-warning data-warning">{warning}</span>}
		</FormGroup>
	);
} // ./PropControl


/**
 * The main part - the actual input.
 * @param {?String} props.rawValue Warning: rawValue === undefined/null means "use storeValue". BUT rawValue === "" means "show a blank"
 */
function PropControl2(props) {
	// track if the user edits, so we can preserve user-set-null/default vs initial-null/default
	// const [userModFlag, setUserModFlag] = useState(false); <-- No: internal state wouldn't let callers distinguish user-set v default
	// unpack ??clean up
	// Minor TODO: keep onUpload, which is a niche prop, in otherStuff
	let { storeValue, value, rawValue, setRawValue, type, optional, required, path, prop, proppath, label, help, tooltip, error, validator, inline, onUpload, fast, ...stuff } = props;	
	// Warning: by here, `value` should be ignored!
	let { bg, set, saveFn, modelValueFromInput, ...otherStuff } = stuff;
	// update is undefined by default, false if fast. See DataStore.update()
	let update;
	if (fast) update = false;
	if (!set) { // set can be a useState setter. If not, use DataStore
		set = newVal => DSsetValue(proppath, newVal, update);
	}

	// HACK: Fill in modelValueFromInput differently depending on whether this is a plugin-type input
	// Temporary while shifting everything to plugins
	if ($widgetForType[type]) {
		if (!modelValueFromInput) {
			modelValueFromInput = rawToStoreForType[type] || standardModelValueFromInput;
		}
	} else {
		if (!modelValueFromInput) {
			if (type === 'html') {
				modelValueFromInput = (_v, type, event, target) => standardModelValueFromInput((target && target.innerHTML) || null, type, event);
			} else {
				modelValueFromInput = standardModelValueFromInput;
			}
		}
	}

	// Define onChange now, so it can be passed in to plugin controls
	// TODO Should this also be pluggable?
	// TODO Normalise setValue usage and event stopping
	let onChange;

	if (PropControl.KControlType.isjson(type)) {
		onChange = event => {
			const rawVal = event.target.value;
			DataStore.setValue(stringPath, rawVal);
			try {
				// empty string is also a valid input - don't try to parse it though
				const newVal = rawVal ? JSON.parse(rawVal) : null;
				set(newVal);
				if (saveFn) saveFn({ event, path, prop, value: newVal });
			} catch (err) {
				// TODO show error feedback
				console.warn(err);
			}
			stopEvent(event);
		};
	} else {
		// text based
		onChange = e => {
			// TODO a debounced property for "do ajax stuff" to hook into. HACK blur = do ajax stuff
			// HACK: allow our own ersatz events to avoid calling setRawValue
			if (!e.cooked) {
				setRawValue(e.target.value);
			}
			let mv = modelValueFromInput(e.target.value, type, e, storeValue, props);
			set(mv);
			if (saveFn) saveFn({ event: e, path, prop, value: mv });
			// Enable piggybacking custom onChange functionality ??use-case vs saveFn??
			if (stuff.onChange && typeof stuff.onChange === 'function') stuff.onChange(e);
			stopEvent(e);
		};
	}

	// React complains about nully value given to input - normalise to ''
	if (noVal(storeValue)) storeValue = '';

	// Is there a plugin for this type?
	if ($widgetForType[type]) {
		const Widget = $widgetForType[type];
		const props2 = { ...props, storeValue, set, onChange };
		// Fill in default modelValueFromInput but don't override an explicitly provided one
		if (!modelValueFromInput) props2.modelValueFromInput = rawToStoreForType[type] || standardModelValueFromInput;

		return <Widget {...props2} />
	}

	// Checkbox?
	if (PropControl.KControlType.ischeckbox(type)) {
		// on/off values hack - make sure we don't have "false"
		// Is the checkbox for setting [path].prop = true/false, or for setting path.prop = [pvalue]/null?
		let onValue = props.pvalue || true;
		let offValue = props.pvalue ? null : false;

		if (_.isString(storeValue)) {
			if (storeValue === 'true') onValue = true;
			else if (storeValue === 'false') {
				storeValue = false; /*NB: so bvalue=false below*/
				offValue = false;
			}
		}
		if (_.isNumber(storeValue)) {
			if (storeValue === 1) onValue = 1;
			else if (storeValue === 0) offValue = 0;
		}
		// Coerce other values to boolean
		const bvalue = !!storeValue;
		// ./on/off values hack

		onChange = e => {
			// console.log("onchange", e); // minor TODO DataStore.onchange recognise and handle events
			const isOn = e && e.target && e.target.checked;
			const newVal = isOn ? onValue : offValue;
			set(newVal); // Debugging no-visual-update bug May 2022 on testmy.gl: tried update=true here -- no change :(
			setTimeout(() => DataStore.update(), 1); // HACK for no-visual-update bug May 2022 seen on testmy.gl
			if (saveFn) saveFn({ event: e, path, prop, value: newVal });
		};

		const helpIcon = tooltip ? <Misc.Icon fa="question-circle" title={tooltip} /> : null;
		delete otherStuff.size;
		delete otherStuff.dflt; // TODO handle checkbox default

		return <Label check size={props.size} className="mr-1">
			<Input bsSize={props.size} type="checkbox" checked={bvalue} value={bvalue} onChange={onChange} {...otherStuff} />
			{label} {helpIcon}
		</Label>;
	} // ./checkbox

	// @deprecated: prefer PropControlEntrySet - only known use of this is portal, AdDesignExtraControls
	if (type === 'keyvalue') {
		return <MapEditor {...props} />
	}

	if (type === 'XId') {
		let service = otherStuff.service || 'WTF'; // FIXME // Does this actually need fixing? Is there any sensible default?
		const displayValue = storeValue ? storeValue.replace('@' + service, '') : ''; // Strip @service wart for display
		modelValueFromInput = s => s ? Misc.normalise(s) + '@' + service : null;
		return (
			<div className="input-group">
				<FormControl type="text" name={prop} value={displayValue} onChange={onChange} {...otherStuff} />
				<span className="input-group-append input-group-text">{toTitleCase(service)}</span>
			</div>
		);
	}

	// @deprecated for pills
	if (type === 'arraytext') {
		return <PropControlArrayText {...props} />;
	}

	if (type === 'keyset') {
		return <PropControlKeySet {...props} />;
	}

	if (type === 'entryset') {
		return <PropControlEntrySet {...props} />;
	}

	if (type === 'textarea') {
		return <textarea className="form-control" name={prop} onChange={onChange} {...otherStuff} value={storeValue} />;
	}

	if (type === 'html') {
		// NB: relies on a special-case innerHTML version of modelValueFromInput, set above

		// Use dangerouslySetInnerHTML when element is empty, but leave uncontrolled
		// thereafter, as overwriting HTML content resets the position of the edit caret
		const inputRef = useRef();
		if (inputRef.current && inputRef.current.innerHTML.length === 0) {
			otherStuff.dangerouslySetInnerHTML = { __html: storeValue };
		}

		// TODO onKeyDown={captureTab}
		return <div contentEditable className="form-control" name={prop}
			onChange={onChange}
			onInput={onChange}
			onBlur={onChange}
			ref={inputRef}
			{...otherStuff}
			style={{ height: 'auto' }}
		/>;
	}

	// TODO Use rawValue/storeValue to normalise away the transient hack
	if (type === 'json') {
		let stringPath = ['transient'].concat(proppath);
		let svalue = DataStore.getValue(stringPath) || JSON.stringify(storeValue);

		return <textarea className="form-control" name={prop} onChange={onChange} {...otherStuff} value={svalue} />;
	}

	if (type === 'radio') {
		return <PropControlRadio storeValue={storeValue} value={value} {...props} />
	}

	if (type === 'select') {
		let props2 = { onChange, storeValue, value, modelValueFromInput, ...props };
		if (props.title) props2.title = props.title;
		return <PropControlSelect {...props2} />
	}

	// HACK just a few countries. TODO load in an iso list + autocomplete
	if (type === 'country') {
		let props2 = { onChange, value, ...props };
		const countryMap = new Map(Object.entries(countryListAlpha2)); // Map??
		let countryOptions = Array.from(countryMap.keys());
		let countryLabels = Array.from(countryMap.values());

		props2.options = countryOptions;
		props2.labels = countryLabels;
		return <PropControlSelect {...props2} />;
	}

	if (type === 'gender') {
		let props2 = { onChange, value, ...props };

		props2.options = ["male", "female", "others", "nottosay"];
		props2.labels = ["Male", "Female", "Others", "Preferred not to say"];
		return <PropControlSelect {...props2} />;
	}

	if (type === 'color') {
		return <PropControlColor type={type} name={prop} value={storeValue} onChange={onChange} {...otherStuff} />;
	}

	// normal
	return <FormControl type={type} name={prop} value={storeValue} onChange={onChange} {...otherStuff} />;
} //./PropControl2


const FOCUS_PATH = ['widget', 'PropControl', 'focus'];


/**
 * Status: doesn't work :(
 * @param {?String[]} proppath
 */
const setFocus = (proppath) => {
	DataStore.setValue(FOCUS_PATH, proppath ? proppath[proppath.length - 1] : null); // TODO .join('.')
}


// /**
//  * TODO
//  * @param {Event} e
//  */
// let captureTab = e => {
// 	console.warn(e, e.keyCode, e.keyCode===9);
// 	if (e.keyCode !== 9) return;
// 	e.preventDefault();
// };


/**
 * @param {any[]} options Will be de-duped.
 * @param {String[]|Function|Object} [labels] Map options to nice strings
 * @param {boolean} [multiple] If true, this is a multi-select which handles arrays of values.
 * @param {boolean} [canUnset] If true, always offer an unset choice.
 */
function PropControlSelect({ options, labels, storeValue, value, rawValue, setRawValue, multiple, prop, onChange, saveFn, set, canUnset, inline, size, ...otherStuff }) {
	// NB inline does nothing here?
	// NB: pull off internal attributes so the select is happy with rest
	const { className, recursing, modelValueFromInput, label, ...rest } = otherStuff;
	assert(options, 'PropControl: no options for select ' + [prop, otherStuff]);
	assert(options.map, 'PropControl: options not an array ' + options);
	options = _.uniq(options);
	const labelFn = labeller(options, labels);

	// Multi-select is a usability mess, so we use a row of checkboxes.
	if (multiple) {
		return PropControlMultiSelect({ storeValue, value, rawValue, setRawValue, prop, onChange, labelFn, options, size, className, modelValueFromInput, ...rest });
	}

	// make the options html
	const domOptions = options.map((option, index) => {
		// The big IAB Taxonomy dropdown has some dupe names which are used as options
		// - so permit a keys list, separate from the option strings, to differentiate them
		const thisKey = 'option_' + ((otherStuff.keys && otherStuff.keys[index]) || JSON.stringify(option));
		return <option key={thisKey} value={option} >{labelFn(option)}</option>;
	});
	const showUnset = (canUnset || !storeValue) && !options.includes(null) && !options.includes('');

	/* text-muted is for my-loop mirror card
	** so that unknown values are grayed out TODO do this in the my-loop DigitalMirrorCard.jsx perhaps via labeller or via css */
	const safeValue = storeValue || ''; // "correct usage" - controlled selects shouldn't have null/undef value
	return (
		<select className={space('form-control', size && "form-control-"+size, className)}
			name={prop} value={safeValue} onChange={onChange}
			{...rest}
		>
			{showUnset ? <option></option> : null}
			{domOptions}
		</select>
	);
}

/**
 * render multi select as multi checkbox 'cos React (Jan 2019) is awkward about multi-select
 * Apr 2020: Multi-select works fine but keep rendering as row of checkboxes because it's a usability mess
 * Deselect everything unless user holds Ctrl??? Really? -RM
 */
function PropControlMultiSelect({ storeValue, value, prop, labelFn, options, modelValueFromInput, className, type, path, saveFn }) {
	assert(!value || value.length !== undefined, "value should be an array", value, prop);

	let onChange = e => {
		const evtVal = e && e.target && e.target.value;
		const checked = e && e.target && e.target.checked;
		let mv = modelValueFromInput(evtVal, type, e, storeValue);
		// console.warn("onChange", val, checked, mv, e);

		let newMvs = checked ? (
			(value || []).concat(mv)
		) : (
			(value || []).filter(v => v !== mv)
		);

		const proppath = path.concat(prop);
		// Turn null/undef DataStore value into an empty set so the real edit triggers local-status-dirty and autosave.
		// TODO Fix DS and remove - setting a value over null/undefined should trigger save anyway
		if (!is(value)) DSsetValue(proppath, []);
		DSsetValue(proppath, newMvs);
		if (saveFn) saveFn({ event: e, path, prop, value: newMvs });
	}

	let domOptions = options.map(option => {
		// React doesn't like when an input's value changes from undefined to an explicit value, so...
		const checked = !!(value && value.includes(option)); // coerce from undefined/null to boolean false
		return (
			<FormGroup inline check key={`option_${option}`}>
				<Label check><Input type="checkbox" value={option} checked={checked} onChange={onChange} />{labelFn(option)}</Label>
			</FormGroup>
		);
	});

	return (
		<Form className={className}>
			{domOptions}
		</Form>
	);
}


/**
 * TODO buttons style
 * Radio buttons
 * @param {Object} p
 * @param {String} p.value
 * @param {String[] | Function | Object} p.labels Optional value-to-string convertor.
 */
function PropControlRadio({ type, prop, storeValue, value, path, saveFn, options, labels, inline, size, rawValue, setRawValue, ...otherStuff }) {
	assert(options, `PropControl: no options for radio ${prop}`);
	assert(options.map, `PropControl: radio options for ${prop} not an array: ${options}`);

	// Make an option -> nice label function
	// the labels prop can be a map or a function
	let labelFn = labeller(options, labels);

	assert(type === 'radio');
	const inputType = 'radio';

	const onChange = e => {
		console.log("onchange", e); // minor TODO DataStore.onchange recognise and handle events
		let val = e && e.target && e.target.value;
		DSsetValue(path.concat(prop), val);
		if (saveFn) saveFn({ event: e, path, prop, value: val });
	};

	return (
		<Form>
			{options.map(option => (
				<FormGroup check inline={inline} key={option}>
					<Label check>
						<Input type={inputType} key={`option_${option}`}
							name={prop} value={option}
							checked={option == storeValue}
							onChange={onChange} {...otherStuff}
						/>
						{labelFn(option)}
					</Label>
				</FormGroup>
			))}
		</Form>
	);
} // ./radio


/**
 * Strip commas £/$/euro and parse float
 * @param {*} v
 * @returns Number. undefined/null are returned as-is. Bad inputs return NaN
 */
const numFromAnything = v => {
	if (noVal(v)) return v;
	// NB: _.isNumber fails for numeric-strings e.g. "1" -- but the later code will handle that
	if (_.isNumber(v)) return v;
	// strip any commas, e.g. 1,000
	if (_.isString(v)) {
		v = v.replace(/,/g, "");
		// £ / $ / euro
		v = v.replace(/^(-)?[£$\u20AC]/, "$1");
	}
	return parseFloat(v);
};


/**
 * @Deprecated for pills
 * Display a value as 'a b c' but store as ['a', 'b', 'c']
 * Used to edit variant.style. 
 * 
 * ??should this be pills??
 */
function PropControlArrayText({ storeValue, value, rawValue, setRawValue, prop, proppath, saveFn, ...otherStuff }) {
	const onChange = e => {
		const oldValue = DataStore.getValue(proppath) || [];
		const oldString = oldValue.join(' ');
		const newString = e.target.value;
		let newValue = newString.split(' ');

		// Remove falsy entries ONLY if change is a deletion.(ie newString is substring of oldString)
		// Allows user to type eg 'one' (['one']) -> "one " ('one', '') -> "one two" ('one', 'two')
		// without filter removing the trailing space.
		if (oldString.indexOf(newString) >= 0) {
			newValue = newValue.filter(val => val);
		}

		DSsetValue(proppath, newValue);
		if (saveFn) saveFn({ event: e, path, prop, value: newValue });
		e.preventDefault();
		e.stopPropagation();
	}
	const safeValue = (storeValue || []).join(' ');
	return <FormControl name={prop} value={safeValue} onChange={onChange} {...otherStuff} />;
}


/**
 * Special case of PropControlEntrySet where values are either true or not displayed.
 * Used for eg Custom Parameters control on the advert editor
 * -eg "I want to flag this ad as 'no_tq' and 'skip_splash'
 * TODO Should this be a literal special case of the PropControlEntrySet code?
 * @param {{String: Boolean}} value Can be null initially
 */
function PropControlKeySet({ value, prop, proppath, saveFn }) {
	const addRemoveKey = (key, remove) => {
		const newValue = { ...value };
		// Set false for "remove" instead of deleting because back-end performs a merge on update, which would lose simple key removal
		// TODO this leads to the data being a bit messy, with ambiguous false flags.
		// ...But we want to keep update (i.e. merge) behaviour over fresh-index in general.
		// ...TODO DataStore to maintain a diff, which it can send to the backend.
		newValue[key] = remove ? false : true;
		// Turn null/undef DataStore value into an empty set so the real edit triggers local-status-dirty and autosave.
		// TODO Fix DS and remove - setting a value over null/undefined should trigger save anyway
		if (!value) DSsetValue(proppath, {});
		DSsetValue(proppath, newValue);
		if (saveFn) saveFn({ event: {}, path, prop, value: newValue });
	}

	const keyElements = Object.keys(value || {}).filter(key => value[key]).map(key => (
		<span className="key" key={key}>{key} <span className="remove-key" onClick={() => addRemoveKey(key, true)}>&times;</span></span>
	));

	let [newKey, setNewKey] = useState();

	// turn a raw input event into an add-key event
	const onSubmit = (e) => {
		stopEvent(e);
		if (!newKey) return;
		addRemoveKey(newKey);
		setNewKey('');
	};

	return (
		<div className="keyset">
			<div className="keys">{keyElements}</div>
			<Form inline onSubmit={onSubmit}>
				<Input value={newKey} onChange={(e) => setNewKey(e.target.value)} className="mr-1" />
				<Button type="submit" disabled={!newKey} color="primary" >Add</Button>
			</Form>
		</div>
	);
}


/**
 * Convenience for editing a set of key-value pairs - eg the numerous string overrides stored on an Advert under customText
 * @param {{String: String}} value Can be null initially
 * @param {?String} keyName Explanatory placeholder text for entry key
 * @param {?String} valueName Explanatory placeholder text for entry value
 */
function PropControlEntrySet({ value, prop, proppath, saveFn, keyName = 'Key', valueName = 'Value' }) {
	const updateKV = (key, val, remove) => {
		if (!key) return;
		const newValue = { ...value };
		// set false instead of deleting - see rationale/TODO in PropControlKeySet
		newValue[key] = remove ? false : val;
		// Turn null/undef DataStore value into an empty set so the real edit triggers local-status-dirty and autosave.
		// TODO Fix DS and remove - setting a value over null/undefined should trigger save anyway
		if (!value) DSsetValue(proppath, {});
		DSsetValue(proppath, newValue);
		if (saveFn) saveFn({ event: {}, path, prop, value: newValue });
	}

	const entries = Object.entries(value || {}).filter(([, val]) => (val === '') || val);
	// pb-2 classes are to give some vertical separation between rows
	const entryElements = entries.length ? (
		entries.map(([key, thisVal]) => (
			<tr className="entry" key={key}>
				<td className="pb-2">
					<Button className="remove-entry" onClick={() => updateKV(key, null, true)} title="Remove this entry">&#10761;</Button>
				</td>
				<td className="px-2">{key}:</td>
				<td className="pb-2"><Input value={thisVal} onChange={(e) => updateKV(key, e.target.value)} /></td>
			</tr>
		))
	) : (
		<tr><td>(No entries)</td></tr>
	);

	// No reason for DataStore to know about the state of the "not added yet" textboxes - so manage them internally
	const [newKey, setNewKey] = useState('');
	const [newValue, setNewValue] = useState('');

	const onSubmit = (e) => {
		stopEvent(e);
		if (!newKey || !newValue) return;
		updateKV(newKey, newValue);
		setNewKey('');
		setNewValue('');
	};

	return (
		<div className="entryset">
			<table className="entries">
				{entries.length ? <thead><tr><th></th><th>{keyName}</th><th>{valueName}</th></tr></thead> : null}
				<tbody>{entryElements}</tbody>
			</table>
			<Form inline onSubmit={onSubmit} className="mb-2">
				<FormGroup className="mr-2">
					<Input value={newKey} placeholder={keyName} onChange={(e) => setNewKey(e.target.value)} />
				</FormGroup>
				<FormGroup className="mr-2">
					<Input value={newValue} placeholder={valueName} onChange={(e) => setNewValue(e.target.value)} />
				</FormGroup>
				<FormGroup>
					<Button type="submit" disabled={!(newKey && newValue)} color="primary">Add this</Button>
				</FormGroup>
			</Form>
		</div>
	);
}


/** Add "colour not set" indicator and "remove colour" button to <input type="color"> */
function PropControlColor({ onChange, disabled, ...props }) {
	const luminance = luminanceFromHex(props.value || '#000000')
	const overlayClass = `form-control overlay ${!props.value ? 'no-color' : ''} ${luminance > 0.5 ? 'light-bg' : ''}`;
	const overlayText = props.value || 'None';

	// Allow user to clear the colour if present...
	// but supply a dummy element (so FormControl still makes an input-group) that won't look strange behind the "no colour" overlay if not
	const clearBtn = props.value ? <Button disabled={disabled} onClick={() => !disabled && onChange({ target: { value: '' } })}>&times;</Button> : <InputGroupText />;

	// Colour unset? 
	if (!props.value) {
		// Give the <input> a dummy value attribute to stop browsers complaining...
		props.value = '#000000';
		// ...but this means if the first colour picked is black, onChange won't fire.
		// So insert a shim to save to DataStore if the user goes straight from "unset" to "#000000"
		props.onBlur = (e) => e.target.value && onChange(e);
	}

	// According to best practices, <input type="color"> shouldn't take onChange
	// (though React normalises it to reliably produce change events)
	// Dan: React complains (noisily but harmlessly) if there isn't an onChange. MDN says onChange and onInput are both fine https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Input/color#tracking_color_changes
	// Supply both? Tested in studio, and seems to work fine. May 2021
	props.onInput = onChange;

	return (
		<div className="color-control">
			<FormControl append={clearBtn} {...props} onChange={onChange} disabled={disabled} />
			<div className={overlayClass}>{overlayText}</div>
		</div>
	);
}


/**
* Convert inputs (probably text) into the model's format (e.g. numerical)
* @param {?primitive} inputValue - The html value, often a String
* @param {KControlType} type - The PropControl type, e.g. "text" or "date"
* @param {String} event.type "change"|"blur" More aggressive edits should only be done on "blur"
* @returns the model value/object to be stored in DataStore
*/
const standardModelValueFromInput = (inputValue, type, event, oldStoreValue, props) => {
	if (!inputValue) return inputValue;
	// numerical?
	if (type === 'year') {
		return parseInt(inputValue);
	}
	if (type === 'number') {
		let n = numFromAnything(inputValue);
		if (props.int) {
			const roundedVal = Math.round(n);
			if (!Number.isNaN(roundedVal)) {
				return roundedVal;
			}
		}
		return n;
	}
	// url: add in https:// if missing
	if (type === 'url' && event.type === 'blur') {
		if (inputValue.indexOf('://') === -1 && inputValue[0] !== '/' && 'http'.substr(0, inputValue.length) !== inputValue.substr(0, 4)) {
			inputValue = 'https://' + inputValue;
		}
	}
	// normalise text
	if (type === 'text' || type === 'textarea') {
		inputValue = Misc.normalise(inputValue);
	}
	return inputValue;
};


/**
 * An input (with prepend/append)
 * 
 * onChange
 * 
 * NB: half the "inputs" here are to remove them from otherProps
 * TODO do it all via delete??
*/
function FormControl({ value, type, required, size, className, prepend, append, proppath, placeholder,
	 onChange, onEnter, onKeyDown, ...otherProps }) 
{
	if (noVal(value)) value = '';

	// add css classes for required fields
	let klass = space(
		className,
		required && 'form-required',
		(required && !value) && 'blank',
		// type==='range' && "form-control-range"
	);

	// remove stuff intended for other types that will upset input	
	delete otherProps.options;
	delete otherProps.labels;
	delete otherProps.rawValue;
	delete otherProps.set;
	delete otherProps.setRawValue;
	delete otherProps.path;
	delete otherProps.modelValueFromInput;
	delete otherProps.saveFn;
	delete otherProps.item;
	delete otherProps.int;

	// if (otherProps.readonly) { nah, let react complain and the dev can fix the cause
	// 	otherProps.readonly = otherProps.readOnly;
	// 	delete otherProps.readOnly;
	// }
	if (size) {
		if (!['sm', 'lg'].includes(size)) console.warn("Odd size", size, otherProps);
	}
	// // focus? Doesn't seem to work ?!
	let focus = otherProps.focus;
	// const focusPath = DataStore.getValue(FOCUS_PATH)
	// const autoFocus = otherProps.name===focusPath; // TODO proppath.join(".") === focusPath;

	// submit if the user types return?
	let onKeyDown2 = onKeyDown;
	if (onEnter) {
		let onEnter2 = e => {
			if (e.key === "Enter") {
				onEnter(new FakeEvent(value));
			}
		};
		if (onKeyDown) {
			onKeyDown2 = e => { onKeyDown(e); onEnter2(e); };
		} else {
			onKeyDown2 = onEnter2;
		}
	}
	// console.log("FormControl", value, otherProps);

	// TODO The prepend addon adds the InputGroupText wrapper automatically... should it match appendAddon?
	if (prepend || append) {
		// Warning: InputGroupAddon is reactstrap v8 only - it is not in v9
		return (
			<InputGroup className={klass} size={size}>
				{prepend ? <InputGroupAddon addonType="prepend"><InputGroupText>{prepend}</InputGroupText></InputGroupAddon> : null}
				<Input type={type} value={value} placeholder={placeholder} onChange={onChange} onKeyDown={onKeyDown2} {...otherProps} />
				{append ? <InputGroupAddon addonType="append">{append}</InputGroupAddon> : null}
			</InputGroup>
		);
	}

	return <Input className={klass} bsSize={size} type={type} value={value} placeholder={placeholder} onChange={onChange} onKeyDown={onKeyDown2} {...otherProps} />;
}


/**
   * List of types eg textarea
   * TODO allow other jsx files to add to this - for more modular code.
   */
PropControl.KControlType = new Enum(
	"textarea html text search select radio password email color checkbox range"
	// + " img imgUpload videoUpload bothUpload url yesNo date " // Removed to avoid double-add
	+ " location year number arraytext keyset entryset address postcode json"
	// some Good-Loop data-classes
	+ " XId keyvalue"
	// My Data 
	+ " country gender privacylevel");

// for search -- an x icon?? https://stackoverflow.com/questions/45696685/search-input-with-an-icon-bootstrap-4



/**
 * DEPRECATED replace/merge with PropControlEntrySet
 * @param {*} param0
 * @param {Function} removeFn Takes (map, key), returns new map - use if "removing" a key means something other than just deleting it
 * @param {Function} filterFn Takes (key, value), returns boolean - use if some entries should't be shown
 */
function MapEditor({ prop, proppath, value, $KeyProp, $ValProp, removeFn, filterFn = (() => true) }) {
	assert($KeyProp && $ValProp, "PropControl MapEditor " + prop + ": missing $KeyProp or $ValProp jsx (probably PropControl) widgets");
	const temppath = ['widget', 'MapEditor'].concat(proppath);
	const kv = DataStore.getValue(temppath) || {};

	const addKV = () => {
		// Don't execute nonsensical or no-op updates
		if (!kv.key) return;
		const k = kv.key.trim();
		if (!k) return;
		if (value && kv.val === value[k]) return;

		// Break identity so shallow comparison sees a change
		const newMap = { ...value, [k]: kv.val };
		// Turn null/undef DataStore value into an empty set so the real edit triggers local-status-dirty and autosave.
		// TODO Fix DS and remove - setting a value over null/undefined should trigger save anyway
		if (!value) DSsetValue(proppath, {});
		DSsetValue(proppath, newMap);
		DSsetValue(temppath, null);
	};

	const rmK = k => {
		// Break identity so shallow comparison sees a change
		let newMap = { ...value };
		if (removeFn) {
			newMap = removeFn(newMap, k);
		} else {
			delete newMap[k];
		}
		DataStore.setValue(proppath, newMap, true);
	};

	// Is there a "don't show these entries" rule? Apply it now.
	const vkeys = Object.keys(value || {}).filter(k => filterFn(k, value[k]));
	const entryRows = vkeys.map(k => (
		<Row key={k}>
			<Col xs="12" sm="5">{k}</Col>
			<Col xs="8" sm="5">
				{React.cloneElement($ValProp, { path: proppath, prop: k, label: null })}
			</Col>
			<Col xs="4" sm="2">
				<Button onClick={() => rmK(k)}><b>-</b></Button>
			</Col>
		</Row>
	));

	// FormGroup, empty label and extra div on Add button are hacks for vertical alignment
	return <>
		<Row key="add-entry">
			<Col xs="12" sm="5">
				{React.cloneElement($KeyProp, { path: temppath, prop: 'key' })}
			</Col>
			<Col xs="8" sm="5">
				{React.cloneElement($ValProp, { path: temppath, prop: 'val' })}
			</Col>
			<Col xs="4" sm="2">
				<FormGroup>
					<Label>&nbsp;</Label>
					<Button onClick={addKV} disabled={!kv.key || !kv.val}><b>+</b> Add</Button>
				</FormGroup>
			</Col>
		</Row>
		{entryRows}
	</>;
} // ./MapEditor


/** INPUT STATUS */
class InputStatus extends JSend {

}


/**
 * e.g. "url: warning: use https for security"
 */
InputStatus.str = is => [(is.path ? is.path[is.path.length - 1] : null), is.status, is.message].join(': ');

/** NB: the final path bit is to allow for status to be logged at different levels of the data-model tree */
const statusPath = path => ['misc', 'inputStatus'].concat(path).concat('_status');

/**
 * e.g. an error with the input
 * @param {?String} status - if null, remove any message
 */
const setInputStatus = ({ path, status, message }) => {
	const spath = statusPath(path);
	// no-op?
	const old = DataStore.getValue(spath);
	if (!old && !status) return;
	// _.isEqual was comparing old: {status, path, message} to {status, message}
	if (old && old.status === status && old.message === message) {
		return;
	}
	// No status? Null out the whole object.
	const newStatus = status ? { path, status, message } : null;
	// NB: don't update inside a render loop
	setTimeout(() => DataStore.setValue(spath, newStatus), 1);
};


/**
 * @param {!String[]} path
 * @return {InputStatus} or null
 */
const getInputStatus = path => {
	const spath = statusPath(path);
	return DataStore.getValue(spath);
}


/**
 * @param {!String[]} path
 * @return {!InputStatus[]} The status for this node and all child nodes
 */
const getInputStatuses = path => {
	// if (true) return []; // possibly causing a performance issue?? On Feb 2019
	assMatch(path, 'String[]');
	const sppath = ['misc', 'inputStatus'].concat(path);
	const root = DataStore.getValue(sppath);
	const all = [];
	getInputStatuses2(root, all);
	return all;
}


const getInputStatuses2 = (node, all) => {
	if (!_.isObject(node)) return;
	if (node._status) all.push(node._status);
	// assumes no loops!
	Object.values(node).forEach(kid => getInputStatuses2(kid, all));
};


/**
 * TODO piecemeal refactor to be an extensible system
 */
let $widgetForType = {};
let validatorForType = {};
let rawToStoreForType = {};


/**
 * Extend or change support for a type
 * @param {Object} p
 * @param {!String} p.type e.g. "textarea"
 * @param {!JSX} p.$Widget the widget to render a propcontrol, replacing PropControl2.
 * @param {?Function} p.validator The validator function for this type. Takes ({value, rawValue, props}), returns JSend|String|null.
 * @param {?Function} p.rawToStore AKA modelValueFromInput - converts a valid text input to e.g. numeric, date, etc
 * The label, error, help have _already_ been rendered. This widget should do the control guts.
 * Inputs: (rawValue, ?type, ?event, ?oldStoreValue, ?props)
 */
const registerControl = ({ type, $Widget, validator, rawToStore }) => {
	assMatch(type, String);
	assert($Widget);

	PropControl.KControlType = PropControl.KControlType.concat(type);
	$widgetForType[type] = $Widget;

	if (validator) validatorForType[type] = validator;
	if (rawToStore) rawToStoreForType[type] = rawToStore;
};


/** @deprecated use the FakeEvent instead
// Base for a dummy event with dummy functions so we don't get exceptions when trying to kill it
// TODO Copy-paste from PropControlUpload.jsx - factor out?
 */
export const fakeEvent = {
	preventDefault: () => null,
	stopPropagation: () => null,
	cooked: true, // Signal PropControl wrapper code NOT to call setRawValue
};


/**
 * Base for a dummy event with dummy functions so we don't get exceptions when trying to kill it.
 */
class FakeEvent {
	preventDefault() { return null; }	
	stopPropagation() { return null; }
	cooked=true; // Signal PropControl wrapper code NOT to call setRawValue
	target;
	/** Base for a dummy event. */
	constructor(value) {
		this.target = {value};
	}
}


export {
	registerControl,
	FormControl,
	FakeEvent,
	InputStatus,
	setInputStatus,
	getInputStatus,
	getInputStatuses,
	standardModelValueFromInput,
	setFocus
};
// should we rename it to Input, or StoreInput, ModelInput or some such??
export default PropControl;

