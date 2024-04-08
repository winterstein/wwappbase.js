import _ from 'lodash';
import React, { Component } from 'react';
import { useState } from 'react';
import { useRef } from 'react';
import ImageObject from '../data/ImageObject';
import ServerIO from '../plumbing/ServerIOBase';
import { space } from '../utils/miscutils';

/**
 * 
 * @param {!string} urlString relative
 * @returns {!string}
 */
const getAbsoluteUrl = urlString => {
	let path = "";
	if (urlString[0] !== '/') {
		path = window.location.pathname;
		if (path.includes('/')) {
			path = path.substring(0, path.lastIndexOf('/'))
		}
		path += '/';
	}
	return window.location.protocol+"//"
		+ window.location.host + path + urlString;
};


/**
 * Avoid cross-domain complaints from eg Google by passing requests for resources
 * outside the Good-Loop domain to the media server's automatic cache
 * @param {String} urlString A media URL
 * @param {Number} width The approximate width the resource is to be displayed at, as a percentage of adunit width
 * @returns {String} A URL which will retrieve a cached copy of the file from the Good-Loop media server
 */
// NB: this was wrapped in React.memo which was breaking (unclear why this was in memo)
 const wrapUrl = (urlString, width) => {
	if (!urlString) return null;
	// Put a protocol on protocol-relative URLs to enable parsing
	if (urlString.match(/^\/\//)) {
		urlString = 'https:' + urlString;
	}
	// make relative urls absolute
	if ( ! urlString.includes("//")) {
		urlString = getAbsoluteUrl(urlString);
		// HACK for local (which media server can't access)
		if (urlString.includes("://local")) {
			return urlString;
		}
	}

	const url = new URL(urlString);

	// Check for a "Do not rescale!" marker in the hash
	let noscale = url.hash.match(/\bnoscale\b/);

	// TODO Use window.devicePixelRatio to adjust size when on mobile

	// does the invoking code ask for a particular size? (Don't request resized SVGs)
	let sizeDir = '';
	if (!noscale && width && !url.pathname.match(/\.svg/)) {
		// Check for a for "get a larger or smaller resize than normal" multiplier in the hash
		let multiplier = 1;
		try {
			let newMul = url.hash.match(/\b(\d+(\.\d*)?)x\b/);
			if (newMul) newMul = Number.parseFloat(newMul[1]);
			if (newMul) multiplier = newMul;
		} catch (e) {
			// ignore
		}

		let targetSize = (width ? width : height) * multiplier;
		// Step down through quantised image widths & find smallest one bigger than estimated pixel size
		let qWidth = sizes[0];
		for (let i = 0; i < sizes.length && sizes[i] >= targetSize; i++) {
			qWidth = sizes[i];
		}
		sizeDir = `scaled/w/${qWidth}/`;
	}

	if (!sizeDir && url.hostname.match(/media.good-loop.com$/)) return urlString; // Our media domain? Use it uncached - unless resize was requested
	if (!url.protocol.match(/http/)) return urlString; // Not HTTP (eg data: url)? Use it uncached

	// preserve extension because MIME-type at the server side is going to be based on wild filename-based guesses
	const extension = url.pathname.match(/\.[^.]+$/);
	// This is going to be used as a filename/URL, so '/' in the encoded string is unsafe
	// However, there's a URL + filesystem-safe base64 standard we can transform to easily
	// See https://tools.ietf.org/html/rfc4648#section-5
	let filename = btoa(urlString).replace('+', '-').replace('/', '_') + extension;

	let params = '?from=good-loop-ad-unit';

	// The base64-encoded filename may be longer than the 255-character limit imposed by EXT4.
	// In this case - use a hash of the URL as the filename, and explicitly tell the servlet
	// the URL to fetch in the case of a cache miss.
	if (filename.length > 250) { // allow a safety margin - longest name on media cluster is 220 characters.
		// 16 hex characters = 128 bits = probability of collision among 1 trillion hashes too small to store in an IEEE-754 float. Probably enough.
		filename = urlToLongHash(url, 16) + extension;
		params += '&src=' + encodeURIComponent(url);
	}
	return ServerIO.MEDIA_ENDPOINT+'/uploads/mediacache/' + sizeDir + filename + params;
};

/**
 * A drop-in replacement for the html <img> tag, which adds in image size handling via media.gl.com
 * and mobile images via `msrc`. And it can handle ImageObjects
 * 
 * @param {Object} p
 * @param {?ImageObject|String} p.image Alternative to src, which includes credit & license info
 * 
 */
const DynImg = ({src, msrc, image, title, ...props}) => {
	if (image) {
		if ( ! src) {
			src = typeof(image)==='string'? image : image.contentUrl;
		}
		if ( ! title) title = space(image.name, image.author);
	}
	let _src = src;
	// explicit mobile setting?
	if (msrc && isMobile()) {
		_src = msrc;
	}
	if (false && C.SERVER_TYPE !== 'local') {
		return <img src={_src} {...props} />;
	}
	// work out the width
	let [width, setWidth] = useState();
	let ref = useRef();
	let [rendered, setRendered] = useState(0); // this is used to force a redraw
	if ( ! width) {
		// Set img src to instant-loading placeholder data-URL to probe size without loading anything
		_src = transparentPixel;
		if (ref.current) {
			const $img = ref.current;
			// - Check img for an existing width rule
			// - If none, set width: 100% inline, to estimate largest occupied space
			// - Store any existing inline width rule to restore later
			let inlineWidth = '';
			const existingWidth = window.getComputedStyle($img).getPropertyValue('width');
			if ( ! existingWidth) {
				inlineWidth = $img.style.width;
				$img.style.width = '100%'
			}

			// get current pixel width
			width = $img.clientWidth;
			setWidth(width);

			// restore the image's original inline width rule
			if ( ! existingWidth) {
				$img.style.width = inlineWidth;
			}
		} else {
			// set state to force a redraw to fill in
			_.defer(() => setRendered(rendered+1));
		}
	}
	// wrap url
	if (width) {
		// Get scaled + cached image URL and set it on the <img>
		_src = wrapUrl(src, width);
	}

	return <img ref={ref} src={_src} title={title} {...props} />;
};





// Let's quantise image sizes into 360px intervals (ie, neatly matched to common phone screen widths) + some tiny ones for good measure.
const sizes = [ 2160, 1800, 1440, 1080, 720, 360, 180, 90 ];


/** A 1x1 transparent PNG for use as a placeholder src */
const transparentPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=';



/**
 * Below code copy-pasted from adunit utils.js and CommonWidgets.jsx
 * TODO: Figure out how to reconcile adunit and wwappbase so code like this can be shared.
 */

/** Parse out the hash of an image URL and check for a "crop to X% when displaying in a circle" marker */
const getCcrop = (url) => {
	try {
		// Put a protocol on protocol-relative URLs to enable parsing...
		const addProtocol = url.match(/^\/\//) ? 'https:' : '';
		const cropMatch = new URL(addProtocol + url).hash.match(/ccrop\:(\d+)/);
		if (cropMatch && cropMatch[1]) {
			return parseInt(cropMatch[1]); // Found a ccrop:XX marker! Crop to XX% if this BGImg is circular
		}
	} catch (e) {}
}

/**
 * "Cyrb53" hash function copy-pasted from StackOverflow:
 * https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
 * Is it good? Well, people seem to trust it. More importantly it's very small.
 * Variant which returns full 64-bit hash as hex string instead of 53-bit truncated number.
 * @param {string} str Input string
 * @return 8 hex characters
 */
 const cyrb = function(str) {
	let h1 = 0xad54900d, h2 = 0x41c6ce57; // just magic numbers
	for (let i = 0, ch; i < str.length; i++) {
		ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
	h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
	return (h2>>>0).toString(16).padStart(8,0) + (h1>>>0).toString(16).padStart(8,0);
};

/**
 * Extend the output of our hash function to arbitrary length.
 * Q: Does this really reduce likelihood of collision?
 * It seems like it should but I don't have a proof.
 * If we have "string-1-with-hash-a" and "string-2-with-colliding-hash-a"...
 * ...then the next iteration will only ALSO collide if "[hash-a]string-1-with-hash-a"
 * and "[hash-a]string-2-with-colliding-hash-a" also have the same hash. Which is
 * astronomically unlikely... right?
 */
const urlToLongHash = (str, length) => {
	let hash = '';
	while (hash.length < length) {
		hash = hash + cyrb(hash + str);
	}
	return hash.substring(0, length);
};

export default DynImg;
