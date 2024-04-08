/** Functions used to calculate colour contrast ratio
 *  Similar project: https://github.com/LeaVerou/contrast-ratio
 */
import React from 'react';
import { assMatch } from '../utils/assert';

/**
 * @param hex String '#f3f3f3'/'f3f3f3' must be in 6 character format (#fff won't work properly)
 * returns: {r: 243, g: 243, b: 243}
 */
const rgbFromHex = hex => {
	assMatch(hex, 'String');

	hex = hex.replace('#', '');
	const colourCodes = hex.match(/.{2}/g);

	if ( !colourCodes || colourCodes.length !== 3) {
		console.warn('Hex value provided to rgbFromHex does not conform to format #f3f3f3 (hash may be omitted)', {hex, colourCodes});
		return {};
	}

	return {
		r: parseInt(colourCodes[0], 16),
		g: parseInt(colourCodes[1], 16),
		b: parseInt(colourCodes[2], 16)
	};
};

const isValidRGB = v => v <= 255 && v >= 0;

/** 
 * Numerical representation of colour brightness
 * https://en.wikipedia.org/wiki/Relative_luminance
 * @params {r, g, b} RGB colour values 
*/
const luminance = ({r, g, b}) => {
	if( !isValidRGB(r) || !isValidRGB(g) || !isValidRGB(b) ) {
		console.warn('Invalid RGB value provided to luminance', {r, g, b});
		return NaN;
	}

	const a = [r, g, b].map( value => {
		value /= 255;
		return value <= 0.03928 
			? value /12.92
			: ((value + 0.055) / 1.055)**2.4; 
	});

	return (0.2126 * a[0]) + (0.7152 * a[1]) + (0.0722 * a[2]);
};

/** Just a little convenience method */
const luminanceFromHex = hex => {
	const rgb = rgbFromHex(hex);
	return luminance(rgb); 
};

/** 
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 * @params luminance1, luminance2 numerical representation of 'relative brightness' of colour.
 * return number [0, 21]. 0 = no contrast (same colour); 21 = perfect contrast (black on white) 
 * Larger number should be in numerator to avoid returning value < 1
*/
const colourContrast = (luminance1, luminance2) => (Math.max(luminance1, luminance2) + 0.05) / (Math.min(luminance1, luminance2) + 0.05);

/** Takes in two colour hexes. Displays if there is not enough contrast between these */
const ColourWarning = ({hex1, hex2, message}) => {
	const l1 = luminanceFromHex(hex1);
	const l2 = luminanceFromHex(hex2);

	// Will be in range [1, 21]
	const contrast = colourContrast(l1, l2);

	return contrast < 7
		&& <div className="text-danger">
			{message}
		</div>;
};

export {
	ColourWarning,
	rgbFromHex,
	luminanceFromHex,
	colourContrast
};
