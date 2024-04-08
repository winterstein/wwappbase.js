import React from 'react';

import printer from '../utils/printer.js';
import C from '../CBase';
import Misc from './Misc';
import ImageObject from '../data/ImageObject.js';
import LinkOut from './LinkOut.jsx';

/**
 * @type {ImageObject[]}
 */
const IMAGE_CREDITS = [];

/**
 * @type {ImageObject[]}
 */
const MUSIC_CREDITS = [];

/**
 * @type {ImageObject[]} ??
 */
const DATA_CREDITS = [];

/**
 * @type {string[]}
 */
const FUNDER_CREDITS = [];


/**
 * Add an image to the about-page credits. Repeat adds are harmless.
 * @param {?ImageObject} image e.g. {author, url, name, caption}
 */
export const addImageCredit = image => {
	// use author as the key
	if ( ! image || ! image.author) return;
	if (IMAGE_CREDITS.find(ic => ic.author === image.author)) {
		return null;
	}
	IMAGE_CREDITS.push(image);
};
/**
 * Add an image to the about-page credits. Repeat adds are harmless.
 * @param {?ImageObject} image 
 */
export const addMusicCredit = image => {
	// use author as the key
	if ( ! image) return;
	const json = JSON.stringify(image);
	if (MUSIC_CREDITS.find(ic => JSON.stringify(ic) === json)) {
		return null;
	}
	MUSIC_CREDITS.push(image);
};

export const addDataCredit = image => {
	// use author as the key
	if ( ! image) return;
	const json = JSON.stringify(image);
	if (DATA_CREDITS.find(ic => JSON.stringify(ic) === json)) {
		return null;
	}
	DATA_CREDITS.push(image);
};

export const addFunderCredit = funder => {
	if (FUNDER_CREDITS.includes(funder)) {
		return null;
	}
	FUNDER_CREDITS.push(funder);
};


// TODO sponsors

/**
 * 
 * @param {*} param0 
 */
const AboutPage = () => {
	let website = C.app.website; // ?? default to top-level domain
	return (
		<div className="AboutPage">
			<h1>About {C.app.name}</h1>
			{C.app.logo? <img src={C.app.logo} className="img-thumbnail logo-large pull-right" /> : null}

			<p>Please see our website for more information on {C.app.name}: <a href={website}>{website}</a></p>

			{C.app.facebookPage? <a href={C.app.facebookPage}><Misc.Logo service="facebook" /> facebook</a> : null}
			{C.app.facebookAppId? <a href={'https://www.facebook.com/games/?app_id='+C.app.facebookAppId}><Misc.Logo service="facebook" /> facebook</a> : null}

			<p>Software version: <i>{JSON.stringify(C.app.version || 'alpha')}</i></p>
			
			{FUNDER_CREDITS.length && <p>We are grateful to {FUNDER_CREDITS.length? FUNDER_CREDITS.join(", ") : "our funders"} for their support.</p>}
			
			{IMAGE_CREDITS.length && 
				<div><p>This app uses Creative Commons images from various sources.</p>
				{IMAGE_CREDITS.map(image => <LinkOut href={image.url}>{image.name} by {image.author}</LinkOut>)}
				</div>}

			{MUSIC_CREDITS.length &&
				<div>
					<p>This app uses music from:</p>
					{MUSIC_CREDITS.map(image => <LinkOut href={image.url}>{image.name} by {image.author}</LinkOut>)}			
				</div>
			}

			{DATA_CREDITS.length && <div>
				<p>This app uses data from various sources:</p>
				<ul>
					{DATA_CREDITS.map(dataset => <LinkOut href={dataset.url}>{dataset.name} by {dataset.author}</LinkOut>)}				
				</ul>
			</div>}

		</div>
	);
};

export default AboutPage;
