import React, { useEffect, useState } from 'react';
import { Button } from 'reactstrap';
import Icon from '../Icon';

/** Primitive types to pass from the props to the popup's URL params */
const passTypes = ['string', 'number', 'boolean'];

/** Construct a URL for the popup page */
const popupUrl = (params = {}) => {
	let url = '/#editpopup';

	const paramsString = Object.entries(params).map(([k, v]) => {
		if (!passTypes.includes(typeof(v))) return null;
		if (!v) return null;
		return `${k}=${encodeURIComponent(v)}`;
	}).filter(a => !!a).join('&');

	if (paramsString.length) url += `?${paramsString}`;

	return url;
};


/**
 * Add a collection of listeners to a target all at once
 * @param {Object<String, Function>} listeners Maps event name to listener function
 * @param {EventTarget} target Object to listen on
 */
const addListeners = (listeners, target = window) => {
	Object.entries(listeners).forEach(([evt, listener]) => {
		target.addEventListener(evt, listener);
	});
};


/**
 * Remove a collection of listeners from a target all at once
 * @param {Object<String, Function>} listeners Maps event name to listener function
 * @param {EventTarget} target Object to listen on
 */
const removeListeners = (listeners, target = window) => {
	Object.entries(listeners).forEach(([evt, listener]) => {
		target.removeEventListener(evt, listener);
	});
};


/**
 * An accessory button for a PropControl which opens a pop-up window with a linked copy of the PropControl inside.
 * Pop-up window rendering is handled by EditPopUpPage.jsx.
 * To enable, make sure your MainDiv maps #editpopup to EditPopUpPage, and set boolean prop "popup" on any PropControl.
 * @param {Object} p As PropControl - passes most primitive props to the popup as URL params.
 */
export default function PropControl_PopUpButton({path, prop, storeValue, setValue, ...props}) {
	// Keep a handle on the created popup window
	const [popup, setPopup] = useState();

	// Mark outgoing messages with the store binding they're intended for
	const [source, setSource] = useState();
	useEffect(() => { 
		setSource(`gl-popup-control:${JSON.stringify(path.concat(prop))}`);
	}, path);

	// Cleanup added listeners on unmount / page unload
	// Hold a reference because the beforeUnload listener itself needs removing on unmount
	const [listeners, setListeners] = useState();

	// 2-way sync - the popup should receive edits made here as well
	useEffect(() => {
		// Will send popup's own updates back to it - but those are triggered
		// by PropControl.saveFn, which isn't tripped by DataStore.setValue, so no update loop.
		if (popup && !popup.closed) popup.postMessage({source, value: storeValue});
	}, [storeValue]);

	// Create a popup control window bound to this data-path
	const openPopup = () => {
		if (popup && !popup.closed) {
			popup.focus(); // Already open, just switch to the window.
		} else {
			// Construct the URL and open the window
			const newPopup = window.open(popupUrl({...props, source}), '', 'popup,width=1000,height=700');
			setPopup(newPopup);
		}
	};

	// Set up message listener when the popup window is created or changed
	useEffect(() => {
		if (!popup) return;

		// Clean up old listeners
		if (listeners) removeListeners(listeners);

		// Create new listener functions
		const newListeners = {
			message: function(msg) {
				// Safety: must be same origin & same target DataStore path
				if (msg.origin !== window.location.origin) return;
				if (msg.data.source !== source) return;

				const data = msg.data;
				// Popup sending an edit, update DataStore
				if (data.value) setValue(data.value);
				// Popup loaded & component mounted, init its value
				if (data.ready) popup.postMessage({source, value: storeValue});
				// Popup closed, delete the handle
				if (data.closed) setPopup(null);
			},
			beforeunload: () => {
				removeListeners(newListeners);
				popup?.close(); // Close the popup
			}
		};

		// Register the listeners
		addListeners(newListeners);
		setListeners(newListeners); // Save listener functions for cleanup
		// Cleanup on unmount as well as on tab close
		return newListeners.beforeunload;
	}, [popup]);

	return (
		<Button color="secondary" size="xs" onClick={openPopup} title="Open this editor in its own window">
			<Icon name="popout" />
		</Button>
	);
};
