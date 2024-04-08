

// Status: Not used (yet)


// import React, { useEffect, useRef, useState } from 'react';
// import { Badge, Button } from 'reactstrap';
// import { assert } from '../../utils/assert';
// import { hardNormalize, mapNew, partialMatch } from '../../utils/miscutils';
// import CloseButton from '../CloseButton';

// /**
//  * Specialised inner control to replace PropControlAutoComplete - potentially migrate/expand into it's own PropControl later 
//  * @param {Object} options in format {option:label}
//  * @param {Function} onSelect
//  */
// export const Autofill = ({value, onSelect, options}) => {

//     let labels = Object.values(options);
//     labels = labels.filter(label => hardNormalize(label).includes(hardNormalize(value)));
//     //labels.sort((a, b) => partialMatch(b, value, true) - partialMatch(a, value, true));
//     let filteredOptions = {};
//     labels.forEach(label => {
//         Object.keys(options).forEach(option => {
//             if (options[option] === label) {
//                 filteredOptions[option] = label;
//                 return;
//             }
//         });
//     });

//     return <div className="position-absolute bg-white autofill"
//         style={{
//             top:"100%", maxHeight:260, overflowY: "auto",
//             boxShadow: "0 3px 3px rgba(0,0,0,0.3)",
//             zIndex:2
//         }}
//     >
//         {Object.keys(filteredOptions).map(option =>
//             <div className="autofill-option dropdown-item" key={option} onClick={() => onSelect(option)}>
//                 <p>{options[option]}</p>
//             </div>
//         )}
//     </div>
// };

// /**
//  * A version of TagInput that can take multiple words per tag, for example pronouns
//  * Should probably be rewritten as its own PropControl at some point
//  * @param {*} wordNum
//  * @param {*} tags an array of arrays each of length wordNum
//  * @param {*} onAddTag 
//  * @param {*} onRemoveTag 
//  * @param {*} tagFn used to transform the tag objects before being displayed
//  * @param {?Function} onAutofill
//  * @returns 
//  */
// export const TagInputMultiWord = ({wordNum, tags=[], placeholders, alts, onType, onAddTags, onRemoveTag, autofillOptions, tagFn, ...props}) => {

//     assert(onAddTags);
//     assert(onRemoveTag);
//     assert(wordNum);
//     assert(!placeholders || placeholders.length === wordNum);
//     assert(!alts || alts.length == wordNum);

//     const [showAutofill, setShowAutofill] = useState(false);
//     // An array of state functions - creates a 2d array
//     // first index is which input, second is value or set function
//     // e.g. set second input value is vals[1][0]("abc")
//     const vals = mapNew(wordNum, () => useState(""));
//     const inputRefs = mapNew(wordNum, () => useRef(null));

//     const filteredOptions = {};
//     Object.keys(autofillOptions).forEach(option => {
//         if (!tags.includes(option)) filteredOptions[option] = autofillOptions[option];
//     });

//     const currentVals = () => vals.map(v => v[0]).filter(x => x && x !== "");

//     const changeVals = newVals => {
//         assert(newVals.length === wordNum);
//         newVals.forEach((val, i) => {
//             vals[i][1](val);
//         });
//         onType && onType(newVals);
//     }

//     const clearVals = () => {
//         changeVals(mapNew(wordNum, () => ""));
//     }

//     const tryAddTags = tags => {
//         if (!tags) return;
//         // Check for empty tags
//         if (tags.filter(x => x && x !== "").length !== wordNum) return;
//         onAddTags(tags);
//         clearVals();
//     }

//     const tryRemoveTag = tag => {
//         if (!tag) return;
//         onRemoveTag(tag);
//         clearVals();
//     }

//     /** catch backspace (delete tag) and enter (add tag) */
// 	const onKeyUp = e => {
// 		// console.log("keyup", e.key, e.keyCode, e);
// 		/*if (e.key==='Backspace' && tags.length) {
// 			tryRemoveTag(tags[tags.length-1]);
// 		}*/
// 		if (e.key==='Enter') {
// 			tryAddTags(currentVals());
// 		}
// 	};

//     const changeVal = (e, idx) => {
//         const newVal = e.target.value;
//         vals[idx][1](newVal);
//         onType && onType();
//     }

//     const onAutofillSelect = options => {
//         //if (!onAutofill) tryAddTags(options);
//         //else onAutofill(options);
//         changeVals(options);
//     };

//     return (<div className='tag-input'>
//         <div className="tags flex-row flex-wrap">
// 		    {tags.map((tg,i) => <Badge className='mr-1 mb-1' key={i} color="primary">{tagFn ? tagFn(tg) : tg}&nbsp;<CloseButton onClick={e => tryRemoveTag(tg)}/></Badge>)}
//         </div>
//         <div className="new-tags position-relative flex-row" tabIndex={0} onFocus={() => setShowAutofill(true)} onBlur={() => setShowAutofill(false)}>

//             {mapNew(wordNum, i => <input key={i} value={vals[i][0]} className='form-control'
//                 onKeyUp={onKeyUp} placeholder={placeholders && placeholders[i]} ref={inputRefs[i]}
//                 onChange={e => changeVal(e, i)} alt={alts && alts[i]}
//                 style={{
//                     borderTopLeftRadius: i !== 0 ? 0 : undefined,
//                     borderBottomLeftRadius: i !== 0 ? 0 : undefined,
//                     borderLeft: i !== 0 ? "none" : undefined,
//                     borderTopRightRadius: i !== wordNum - 1 ? 0 : undefined,
//                     borderBottomRightRadius: i !== wordNum - 1 ? 0 : undefined,
//                 }}
//                 />)}

//             <Button color="primary" className="px-2 ml-1" style={{borderRadius:5}} onClick={() => tryAddTags(currentVals())}>✓</Button>

//             {showAutofill && autofillOptions && <Autofill value={currentVals().join("/")} options={filteredOptions} onSelect={option => onAutofillSelect(option.split("/"))}/>}
//         </div>
// 	</div>);
// }

// /**
//  * A form input that manipulates a set of tags
//  * Basically a copy/rewrite of PropControlPills, friendly to being embedded in other PropControls
//  * Should probably be rewritten as its own PropControl at some point
//  * @param {*} tags
//  * @param {*} onAddTag 
//  * @param {*} onRemoveTag 
//  * @param {?Object} autofillOptions object of {key: label} options for autofill menu
//  * @returns 
//  */
//  const TagInput = ({tags=[], placeholder, onType, onAddTag, onRemoveTag, autofillOptions, ...props}) => {

//     assert(onAddTag);
//     assert(onRemoveTag);

//     const [changingVal, setChangingVal] = useState("");
//     const [showAutofill, setShowAutofill] = useState(false);

//     const filteredOptions = {};
//     Object.keys(autofillOptions).forEach(option => {
//         if (!tags.includes(option)) filteredOptions[option] = autofillOptions[option];
//     });

//     const changeVal = val => {
//         setChangingVal(val);
//         onType && onType(val);
//     }

//     const tryAddTag = tag => {
//         if (!tag) return;
//         onAddTag(tag);
//         changeVal("");
//     }

//     const tryRemoveTag = tag => {
//         if (!tag) return;
//         onRemoveTag(tag);
//         changeVal("");
//     }

//     const checkOnChange = e => {
// 		// console.log("addTag", e);
// 		let tg = e.target.value || '';
// 		tg = tg.trim();
// 		if ( ! tg || tg.length === 0 || tg === e.target.value) {
// 			// not finished typing - we need word+space to make a pill
// 			changeVal(e.target.value);
// 			return;
// 		}
// 		tryAddTag(tg);
// 	};

//     /** catch backspace (delete tag) and enter (add tag) */
// 	const onKeyUp = e => {
// 		// console.log("keyup", e.key, e.keyCode, e);
// 		if (e.key==='Enter') {
// 			tryAddTag(changingVal);
// 		}
// 	};

//     const onAutofillSelect = option => {
//         changeVal(option);
//     };

//     return (<div className='tag-input'>
//         <div className="tags flex-row flex-wrap">
// 		    {tags.map((tg,i) => <Badge className='mr-1 mb-1' key={i} color="primary">{tg}&nbsp;<CloseButton onClick={e => tryRemoveTag(tg)}/></Badge>)}
//         </div>
//         <div className="new-tags position-relative" tabIndex={0} onFocus={() => setShowAutofill(true)} onBlur={() => setShowAutofill(false)}>
//             <input value={changingVal} className='form-control' placeholder={placeholder}
//                 onChange={checkOnChange} onKeyUp={onKeyUp} {...props}/>
//             {showAutofill && autofillOptions && <Autofill value={changingVal} options={filteredOptions} onSelect={option => onAutofillSelect(option)}/>}
//         </div>
// 	</div>);
// }

// export default TagInput;
