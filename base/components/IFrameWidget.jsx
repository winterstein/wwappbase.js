import React, { useEffect, useState, useCallback } from 'react';
import ServerIO from '../plumbing/ServerIOBase';
import { assMatch } from '../utils/assert';
import { isNumeric } from '../utils/miscutils';
import Misc from './Misc';


/**
 * Stick a tag into a document
 * @param {HTMLDocument} doc The document to put the new element in
 * @param {String} tag The <tag> to create
 * @param {?} attrs Other attributes to apply to the element we create
 * @param {Boolean} prepend True to insert the new element at the start of the document
 * @returns {HTMLElement} the element
 */
const appendEl = (doc, { tag, ...attrs }, prepend) => {
	if (!doc || !doc.createElement || !tag) {
		return; // Can't make an element without a doc and a tag
	}

	// Create the element and assign all properties
	const el = doc.createElement(tag);
	Object.entries(attrs).forEach(([key, val]) => {
		el[key] = val;
	});

	prepend ? doc.body.prepend(el) : doc.body.appendChild(el);
	return el; // just in case we want it
};


/**
	* Insert custom CSS into the adunit's iframe
	* Why do this when the adunit already manages its own CSS?
	* Because it's MUCH faster and more reliable than reloading the ad when iterating design in the portal.
	*/
const insertCss = ({ frame, css }) => {
	if (!frame) return; // don't worry if frame doesn't have a doc, appendEl is safe for that
	// Remove any pre-existing vert-css
	removeCss({ frame });
	if (!css) return; // No CSS supplied? Remove any that exists and we're done

	// Note from Mark 18 Feb 2019: We insert CSS into body instead of head to guarantee it appears later in the
	// document - so it takes precedence & overrides as expected.
	appendEl(frame.contentDocument, { tag: 'style', type: 'text/css', id: 'injected-css', class: 'override', innerHTML: css });
};


/** Remove custom CSS from the adunit's frame */
const removeCss = ({ frame, selector = '#injected-css' }) => {
	// this might be called after the iframe has already been destroyed!
	if (!frame || !frame.contentDocument || !frame.contentDocument.body) return;
	const cssEls = frame.contentDocument.querySelectorAll(selector) || [];
	cssEls.forEach(node => node.parentElement.removeChild(node));
}

/**
 * Set custom json (also removes old custom json)
 */
const insertJson = ({ frame, json }) => {
	if (!frame || !json) {
		return;
	}
	assMatch(json, String);
	const doc = frame.contentDocument;
	const docBody = doc && doc.body;

	removeCss({ frame, selector: "#injected-json" })
	// // No scroll bars!
	// if (docBody) docBody.style = 'overflow: hidden;'; // NB: the if is paranoia - NPE hunt Oct 2019

	// Preloaded unit.json? Insert contents inside a <script> tag for the adunit to find
	appendEl(doc, { tag: 'script', type: 'application/json', id: 'injected-json', innerHTML: unitJson });

	// // Insert the element the unit goes in at the top of the document
	// // Keep it simple: Tell the unit it's already isolated in an iframe and doesn't need to create another.
	// appendEl(doc, {tag: 'div', className: 'goodloopad-frameless'}, true);

	// // insert the <script> tag
	// appendEl(doc, {tag: 'script', src, async: true});

	// On unmount: empty out iframe's document
	// return () => doc ? doc.documentElement.innerHTML = '' : null;
};


/**
 * A widget to insert an iframe.
 * Usage: ??
 * @param {Object} p
 * @param {String} p.url
 * @param {?String} p.css Extra CSS to insert in the unit's iframe - used by portal to show custom styling changes without reload. Optional.
 * @param {?String} p.json Not used
 * @param {String} p.size Defaults to "landscape".
 * @param {?String|Number} p.width e.g. "728px" This overrides `size`
 */
const IFrameWidget = ({ url, css, json, size = 'landscape', width, height,scrolling="auto"}) => {
	if (isNumeric(width)) width +="px";
	if (isNumeric(height)) height +="px";
		// Store refs to the .goodLoopContainer and iframe nodes, to calculate sizing & insert elements
		const [frame, setFrame] = useState();
	const [container, setContainer] = useState();
	const [dummy, redraw] = useState(); // Just use this to provoke a redraw
	const [frameReady, setFrameReady] = useState(false);

	// once-only functions
	const receiveFrame = useCallback(node => {
		setFrame(node);

		// The cases below account for subtle DOM element lifecycle differences between Firefox and Chrome.
		if (!node) {
			setFrameReady(false); // Needs to flip false during element replacement so it triggers the useEffect below
		} else if (node.contentDocument && node.contentDocument.readyState === 'complete') {
			// If the iframe's DOM is ready to use when this ref executes, mark it as such.
			// Do asynchronously so setFrameReady(false) above gets to trigger a render first
			window.setTimeout(() => setFrameReady(true), 0);
		} else {
			// If it's not ready, add an event listener to mark it when it is.
			// NB: Jan 2021: bugs seen where setFrameReady(true) is never called.
			// 'DOMContentLoaded' seems to fire too early (see https://developer.mozilla.org/en-US/docs/Web/API/Window/DOMContentLoaded_event)
			// So trying 'load' instead... It seems to work. (Jan 2021)
			node.contentWindow.addEventListener('load', () => setFrameReady(true));
		}
	}, []);
	const receiveContainer = useCallback(node => setContainer(node), []);

	// This string is meaningless in itself, but when it changes we need to recreate the iframe & reinsert JS.
	// It's used as a key on the iframe to break identity so it's replaced instead of updated.
	const unitKey = url + size;

	// Redo CSS when CSS or adunit frame changes
	useEffect(() => {
		insertCss({ frame, css });
	}, [frame, css]);

	// Set up listeners to redraw this component on window resize or rotate
	useEffect(() => {
		window.addEventListener('resize', redraw);
		window.addEventListener('orientationchange', redraw);

		return () => {
			window.removeEventListener('resize', redraw);
			window.removeEventListener('orientationchange', redraw);
		};
	}, []);

	// Calculate dimensions every render because it's cheap and KISS
	const dims = { width, height };
	if (container && !dims.width) {
		const { cwidth, cheight } = container.getBoundingClientRect();
		// 16:9 --> 100% width, proportional height; 9:16 --> 100% height, proportional width
		if (size === 'landscape') {
			dims.height = `${cwidth * 9 / 16}px`; // 0.5625 = 9/16
		} else if (size === 'portrait') {
			dims.width = `${cheight * 9 / 16}px`;
		}
	}

	return (
		<div className="iFrameContainer" style={dims} ref={receiveContainer}>
			<iframe src={url} key={unitKey} frameBorder={0} scrolling={scrolling} style={{ width: '100%', height: '100%' }} ref={receiveFrame} />
		</div>
	);
};

export default IFrameWidget;
