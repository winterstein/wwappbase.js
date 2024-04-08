import React from 'react';

import PropControl, { registerControl, FormControl } from '../PropControl';
import { DropdownItem, DropdownMenu, DropdownToggle, InputGroup, InputGroupAddon, UncontrolledButtonDropdown } from 'reactstrap';
import { is, noVal } from '../../utils/miscutils';
import Money from '../../data/Money';
import { assert } from '../../utils/assert';

/**
 * See also: Money.js
 * @param currency {?String}
 * @param name {?String} (optional) Use this to set a name for this money, if it has one.
 */
function PropControlMoney2({ prop, storeValue, rawValue, setRawValue, set, path, proppath,
	bg, saveFn, modelValueFromInput, onChange, append, ...otherStuff }) {
	// special case, as this is an object.
	// Which stores its value in two ways, straight and as a x100 no-floats format for the backend
	// Convert null and numbers into Money objects
	if ( ! storeValue || _.isString(storeValue) || _.isNumber(storeValue)) {
		storeValue = rawToStoreMoney(null, null, null, null, null, otherStuff);
	}

	// Prefer raw value (including "" or 0), so numeric substrings which aren't numbers or are "simplifiable", eg "-" or "1.", are preserved while user is in mid-input
	let v = is(rawValue)? rawValue : (storeValue? storeValue.value : null);

	if (noVal(v) || _.isNaN(v)) { // allow 0, which is falsy
		v = '';
	}
	let currencyValue = otherStuff.currency || (storeValue && storeValue.currency) || "GBP";
	let currLabel = Money.CURRENCY[currencyValue] || currencyValue;
	//Money.assIsa(value); // type can be blank

	let $currency;
	let changeCurrency = otherStuff.changeCurrency !== false && ! otherStuff.currency;
	if (changeCurrency) {		
		$currency = (
			<UncontrolledButtonDropdown addonType="prepend" disabled={otherStuff.disabled} id={'input-dropdown-addon-' + JSON.stringify(proppath)}>
				<DropdownToggle caret>{currLabel}</DropdownToggle>
				<DropdownMenu>
					{Object.keys(Money.CURRENCY).map((c,i) => 
						<DropdownItem key={i} onClick={e => onChange({target:{value:c}, type:'currency', cooked:true})}>{Money.CURRENCY[c]}</DropdownItem>
					)}
				</DropdownMenu>
			</UncontrolledButtonDropdown>
		);
	} else {
		$currency = <InputGroupAddon addonType="prepend">{currLabel}</InputGroupAddon>;
	}
	delete otherStuff.changeCurrency;
	delete otherStuff.value;
	assert(v === 0 || v || v === '', [v, storeValue]);
	// make sure all characters are visible
	let minWidth = (("" + v).length / 1.5) + "em";
	return (
		<InputGroup size={otherStuff.size} >
			{$currency}
			<FormControl name={prop} value={v} onChange={onChange} {...otherStuff} style={{ minWidth }} />
			{append ? <InputGroupAddon addonType="append">{append}</InputGroupAddon> : null}
		</InputGroup>
	);
} // ./£

/**
 * Preserve currency if value changes, and vice-versa
 */
const rawToStoreMoney = (rawValue, type, event, oldStoreValue, props) => {
	// keep blank as blank (so we can have unset inputs), otherwise convert to number/undefined
	if (rawValue === '') {
		return null;
	}
	if (event && event.type==='currency') { //Money.CURRENCY[rawValue]) {
		let m = oldStoreValue || new Money();
		m.currency = rawValue;
		if (props.name) m.name = props.name; // set name if specified
		return m;
	}
	let newMoney = new Money(rawValue);
	// preserve name and currency
	newMoney.name = (props && props.name) || (oldStoreValue && oldStoreValue.name);
	newMoney.currency = (props && props.currency) || (oldStoreValue && oldStoreValue.currency);
	// done
	return newMoney;
};


/** Default validator for money values
 * TODO Should this also flag bad, non-empty raw values like £sdfgjklh?
 * @param {?Money} min
 * @param {?Money} max
*/
const moneyValidator = ({value, props}) => {
	let {min,max} = props;
	if (typeof(min) === 'number') min = new Money(min);
	if (typeof(max) === 'number') max = new Money(max);
	let val = value;
	// NB: we can get a Money skeleton object with no set value, seen May 2020
	if (!val || (!val.value && !val.value100p)) {
		return null;
	}
	let nVal = Money.value(val);

	if ( ! Number.isFinite(nVal)) {
		return "Invalid number: " + val.raw;
	}
	if ( ! (nVal * 100).toFixed(2).endsWith(".00")) {
		return {status:"warning", message:"Fractional pence may cause an error later"};
	}
	if (val.error) return {status:"error", message:val.error}; // ??
	if (is(min) && Money.compare(min, val) > 0) return {status:"error", message:"Value is below the minimum " + Money.str(min)};
	if (is(max) && Money.compare(max, val) < 0) return {status:"error", message:"Value is above the maximum " + Money.str(max)};
	return null;
};

registerControl({
	type: 'Money',
	$Widget: PropControlMoney2,
	validator: moneyValidator,
	rawToStore: rawToStoreMoney
});

/**
 * See also: Money.js
 * @param {Object} p
 * @param {?String} p.currency 
 * @param {?String} p.name (optional) Use this to set a name for this money, if it has one.
 */
function PropControlMoney(p) {
	return <PropControl type="Money" {...p} />
}

export default PropControlMoney;
