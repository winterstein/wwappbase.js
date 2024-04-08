import React from 'react';
import { Button } from 'reactstrap';
import PropControlPills from '../PropControlPills';

// PropControlGender - is a PropControlPills

export const PropControlGender = ({path, prop, ...props}) => {
	return <div className="d-flex flex-row">
		<PropControlPills path={path} prop={prop} {...props} />
		<Button color="primary">+</Button>
	</div>
};

export const PropControlPronoun = ({path, prop, ...props}) => {};

/**
 * See Ego.js for more information
 * @param {*} param0 
 */
const PropControlEgo = ({path, prop, saveFn, style, className, ...props}) => {};

export default PropControlEgo;


// import React, { useEffect, useState } from 'react';
// import Ego, { Identity, Pronoun } from '../../data/Ego';
// import { assert } from '../../utils/assert';
// import PropControl, { registerControl, DSsetValue } from '../PropControl';
// import TagInput, { TagInputMultiWord } from './Tags';


// /*
//     DO NOT USE RIGHT NOW - WIP, only being used in specific instances
// */

// export const DEFAULT_GENDER_LABELS = {
//     "male": "Male",
//     "female": "Female",
//     "non-binary": "Non-Binary",
//     "transgender": "Transgender",
//     "transsexual": "Transsexual",
//     "intersex": "Intersex",
//     "bigender": "Bigender",
//     "two-spirit": "Two-Spirit",
//     "androgyne": "Androgyne",
//     "femme": "Femme",
//     "masc": "Masc",
//     "agender": "Agender",
//     "fluid": "Genderfluid"
// };

// /*"they/them/their": new Pronoun("they", "them", "their"),
//     "he/him/his": new Pronoun("he", "him", "his"),
//     "she/her/her": new Pronoun("she", "her", "her"),
//     "it/it/its": new Pronoun("it", "it", "its"),
//     "xe/xem/xyr": new Pronoun("xe", "xem", "xyr"),
//     "fae/faer/faer": new Pronoun("fae", "faer", "faer"),
//     "ae/aer/aer": new Pronoun("ae", "aer", "aer"),
//     "ey/em/eir": new Pronoun("ey", "em", "eir"),
//     "ze/hir/hir": new Pronoun("ze", "hir", "hir"),
//     "ve/ver/vis": new Pronoun("ve", "ver", "vis")*/


// export const DEFAULT_PRONOUNS = {
//     "they/them/their": "they/them/their",
//     "he/him/his": "he/him/his",
//     "she/her/her": "she/her/her",
//     "it/it/its": "it/it/its",
//     "xe/xem/xyr": "xe/xem/xyr",
//     "fae/faer/faer": "fae/faer/faer",
//     "ae/aer/aer": "ae/aer/aer",
//     "ey/em/eir": "ey/em/eir",
//     "ze/hir/hir": "ze/hir/hir",
//     "ve/ver/vis": "ve/ver/vis"
// };

// /**
//  * @deprecated DONT USE YET - very WIP
//  */
// export const PropControlGender = ({storeValue, modelValueFromInput, path, prop, proppath, type, fcolor, saveFn, ...props}) => {

//     if (!storeValue) storeValue = [];
//     if (typeof(storeValue) === "string") {
//         // manage old data
//         storeValue = storeValue.split(',');
//     }

//     const onAddTag = tag => {
//         let tags2 = storeValue ? storeValue.concat(tag) : [tag];
// 		let tags3 = modelValueFromInput? modelValueFromInput(tags2) : tags2;
// 		DSsetValue(proppath, tags3);
// 		if (saveFn) saveFn({path, prop});
//     }

//     const onRemoveTag = tag => {
//         if (!storeValue || !storeValue.length) return;
//         let tags2 = storeValue.filter(t => t !== tag);
// 		// TODO refactor so this is done by PropControl standard code, not plugin widget code
// 		DSsetValue(proppath, tags2);
// 		if (saveFn) saveFn({path, prop});
//     }

//     return <div className="prop-control-gender position-relative">
//         <TagInput tags={storeValue}
//             onAddTag={onAddTag} 
//             onRemoveTag={onRemoveTag}
//             autofillOptions={DEFAULT_GENDER_LABELS}
//         />
//     </div>
// };

// /**
//  * @deprecated DONT USE YET - Still WIP
//  */
// export const PropControlPronoun = ({storeValue, modelValueFromInput, path, prop, proppath, type, fcolor, saveFn, ...props}) => {

//     if (!storeValue) storeValue = [];
//     if (typeof(storeValue) === "string") {
//         // manage old data
//         storeValue = storeValue.split(',');
//     }

//     const onAddTags = tags => {
//         const pronouns = new Pronoun(tags[0], tags[1], tags[2]);
//         let tags2 = storeValue ? storeValue.concat(pronouns) : [pronouns];
// 		let tags3 = modelValueFromInput? modelValueFromInput(tags2) : tags2;
// 		DSsetValue(proppath, tags3);
// 		if (saveFn) saveFn({path, prop});
//     }

//     const onRemoveTag = tag => {
//         if (!storeValue || !storeValue.length) return;
//         let tags2 = storeValue.filter(t => t !== tag);
// 		// TODO refactor so this is done by PropControl standard code, not plugin widget code
// 		DSsetValue(proppath, tags2);
// 		if (saveFn) saveFn({path, prop});
//     }

//     return <div className="prop-control-gender position-relative">
//         <TagInputMultiWord tags={storeValue}
//             wordNum={3}
//             alts={["they", "them", "their"]}
//             placeholders={["they", "them", "their"]}
//             onAddTags={onAddTags} 
//             onRemoveTag={onRemoveTag}
//             autofillOptions={DEFAULT_PRONOUNS}
//             tagFn={tag => Pronoun.fromObj(tag).toString()}
//         />
//     </div>

// };

// /**
//  * @deprecated DONT USE YET still WIP
//  * See Ego.js for more information
//  * @param {*} param0 
//  */
// const PropControlEgo = ({storeValue, modelValueFromInput, path, prop, proppath, type, fcolor, saveFn, ...props}) => {

//     const WIDGET_PATH = ["widget", "PropControlEgo", "controls"];

//     const fullSaveFn = e => {
//         saveFn && saveFn(e);
//     }

//     return <div className="prop-control-ego">
//         <PropControl type="gender" path={proppath.concat("identities", 0, "genders")} prop={0} saveFn={fullSaveFn}/>
//         <PropControl type="checkbox" path={WIDGET_PATH} prop="multigender" label="Multi-gender" help="Show more options for multi-gender identities"/>
//     </div>

// };

// registerControl({type:'gender', $Widget: PropControlGender});
// registerControl({type:'pronoun', $Widget: PropControlPronoun});
// registerControl({type:'ego', $Widget: PropControlEgo});

// export default PropControlEgo;
