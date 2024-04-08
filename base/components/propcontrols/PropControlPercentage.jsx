import React from 'react';

import PropControl, { FormControl, registerControl } from '../PropControl';
import { urlValidator } from './validators';
import Misc from '../Misc';
import JSend from '../../data/JSend';
import { asNum, isNumeric } from '../../utils/miscutils';
import { Input, InputGroup, InputGroupAddon } from 'reactstrap';


/**
 * Display 0-100% but store [0,1] fractions
 * 
 * @param {*} param0 
 * @returns 
 */
function PropControlPercentage2({prop, klass, placeholder, size, storeValue, onChange, set, ...rest}) {
    const value = storeValue? storeValue*100 : storeValue;
    let onChange2 = (a,b,c) => {
        // console.log("onChange2", a.target.value, a,b,c, onChange, set);
        return onChange(a,b,c);
    }
    // console.log("PropControlPercentage2", value, "from", storeValue);
	// return <FormControl type="number" value={value} onChange={onChange2} onBlur={onChange2} {...rest} append="%" /> weird bug: value getting replaced by storeValue?!
    return (
        <InputGroup className={klass} size={size}>
            <Input type="number" value={value} placeholder={placeholder} onChange={onChange2} style={{maxWidth:"8rem"}} />
            <InputGroupAddon addonType="append">%</InputGroupAddon>
        </InputGroup>
    );
};

function pValidator({value, props}) {
    const jsend = new JSend();
    if (value >= 0 && value <= 1) {
        jsend.status = "success";
        return jsend;
    }
    if (value > 1) {
        jsend.status = "warning";
        jsend.message = "Value is too high"
        return jsend;
    }
    if (value < -1) {
        jsend.status = "warning";
        jsend.message = "Value is too large"
        return jsend;
    }
    return jsend;
}

const rawToStore = raw => {    
    let store = isNumeric(raw)? raw / 100.0 : null;
    // console.log("rawToStore", raw, store);
    return store;
}

registerControl({
	type: 'percentage',
	$Widget: PropControlPercentage2,
	validator: pValidator,
    rawToStore 
});

const PropControlPercentage = (args) => <PropControl type="percentage" {...args} />

export default PropControlPercentage;
