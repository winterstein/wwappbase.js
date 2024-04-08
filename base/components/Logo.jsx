
import React from 'react';
import { space, ellipsize } from '../utils/miscutils';
import DataClass, {getId, getName} from '../data/DataClass';
import { assert } from '../utils/assert';


// Check for SVG and use specific width if so
// TODO This breaks layout in the Green Dashboard context where this component is currently used.
// See CharityLogo.jsx in my-loop for original usage - work out a cleaner solution to the problem this was solving before replacing that
const svgClass = (logoUrl) => {
	if (logoUrl?.match(/\.svg(\?.*|#.*)*$/gi)) { // must end with ".svg", allow #... or ?... after
		return 'w-100'; // width 100?? won't that make it giant in the wrong setting??
	}

	return null;
};

/**
 * Logo from branding (also handles NGOs)
 * @param {Object} p
 * @param {DataClass} p.item
 */
function Logo({item, className, size, style, nameCap = 24, logoOnly}) {
	if (!item) return null;
	assert(getId(item) || item.name === "Default Advertiser", 'Not a DataItem', item);

	// get branding
	let branding = item.branding || item; // HACK: NGOs have .logo on the item
	let altText = item.displayName || item.name || getId(item);
	if (nameCap) altText = ellipsize(altText, nameCap);

	const classes = space('logo', size && `logo-${size}`, className, /*svgClass(branding.logo)*/);

	// fallback to entity name
	if ( ! branding.logo) {
		if (logoOnly) return null;
		return <span className={classes} style={style}>{altText}</span>;
	}

	// 'logo' class forces the logos to be too small for the circle - so leaving it out
	return <img className={classes} style={style} src={branding.logo} alt={`Logo for ${altText}`} title={altText} />;
}

export default Logo;
