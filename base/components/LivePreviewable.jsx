import React, { useEffect, useState } from 'react';
import DataStore, { getDataPath } from '../../base/plumbing/DataStore';

/**
 * Wrapper for a page which can be edited live from an external site in an iframe (e.g. the portal)
 * The content should be a component that takes an "object" prop, passed in as Child
 * (This can't be just "children", as the data in object must be passed through and controlled by this component, which a standard wrapper format would override)
 * 
 * @param {Object} object the data to augment from an external editor
 * @param {C.TYPES} dataType 
 * @param {Component} Child the component to pass the data to. must accept an "object" prop
 * @param {?String} urlValidator only accept augmentation from a url including this
 */
const LivePreviewable = ({object, dataType, urlValidator, Child}) => {
	const [msgObj, setMsgObj] = useState({});

	// soft copy for augmentation
	const obj = Object.assign(object, msgObj);

	const updateObject = event => {
		if (event.origin.includes(urlValidator || 'portal.good-loop.com')) {
			if (event.data.startsWith("data:")) {
				const msg = JSON.parse(event.data.substr(5, event.data.length - 4));
				console.log("Reveived object: ", msg);
				setMsgObj(msg.data);
				/*const dataPath = getDataPath({status:KStatus.DRAFT, type:C.TYPES.NGO, id});
				const reducedPath = */
				if (!obj) console.warn("LivePreviewable tried to augment data, but there is no object!");
			}
		}
	}

	useEffect (() => {
		// For portal editing, allows content to be edited while in an iframe without reloading
		window.addEventListener("message", updateObject);
		return () => {window.removeEventListener("message", updateObject)}
	}, []);

	return <Child object={obj}/>;
};

export default LivePreviewable;
