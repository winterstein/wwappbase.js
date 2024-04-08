import React,{ useState } from 'react';

import { registerControl, DSsetValue } from '../PropControl';
import { Badge } from 'reactstrap';
import CloseButton from '../CloseButton';


/**
 * A list-of-strings editor, where the strings are drawn as discrete "pills"
 * 
 * @param {Object} p
 * @param {String[]|String} p.storeValue If a String is passed in, it will be split on commas. The saved value from edits is always String[] 
 * (unless modelValueFromInput is used to join it into a string).
 */
const PropControlPills = ({storeValue, modelValueFromInput, path, prop, proppath, type, fcolor, saveFn}) => {
	let pills = storeValue || [];
	if (typeof(pills)==="string") {
		pills = pills.split(/,\s*/).filter(s => s);
	}

	const removeTag = (tg) => {
		let pills2 = pills.filter(t => t !== tg);
		// TODO refactor so this is done by PropControl standard code, not plugin widget code
		DSsetValue(proppath, pills2);
		if (saveFn) saveFn({path, prop});
	};

	let [rawPartValue, setRawPartValue] = useState('');	
	/** don't add a tag until they've finished the word -- which re recognise via `space` (or enter or blur) */
	const addTagOnChange = e => {
		// console.log("addTag", e);
		let tg = e.target.value || '';
		tg = tg.trim();
		if ( ! tg || tg === e.target.value) {
			// not finished typing - we need word+space to make a pill
			setRawPartValue(e.target.value);
			return;	
		}
		addTag2(tg);
	};
	const addTag2 = tg => {
		if ( ! tg) return;
		let pills2 = pills.concat(tg);
		let pills3 = modelValueFromInput? modelValueFromInput(pills2) : pills2;
		DSsetValue(proppath, pills3);
		if (saveFn) saveFn({path, prop});
		setRawPartValue('');
	}

	/** catch backspace (delete tag) and enter (add tag) */
	const onKeyUp = e => {
		// console.log("keyup", e.key, e.keyCode, e);
		if (e.key==='Backspace' && pills.length) {
			removeTag(pills[pills.length-1]);
		}
		if (e.key==='Enter' && pills.length) {
			addTag2(rawPartValue);
		}
	};

	return (<div className='form-control flex-row'>
		{pills.map((tg,i) => <Badge className='mr-1' key={i} color={fcolor && fcolor(tg)}>{tg} <CloseButton onClick={e => removeTag(tg)}/></Badge>)}
		<input value={rawPartValue} className='flex-grow'
			onChange={addTagOnChange} onKeyUp={onKeyUp} onBlur={e => addTag2(rawPartValue)} />
	</div>);
}

registerControl({
	type:'pills',
	$Widget: PropControlPills
});

export default PropControlPills;