/** Data model functions for the Advert data-type. */
import { assert, assMatch } from '../utils/assert';
import Enum from 'easy-enums';
import DataClass from './DataClass';
import C from '../CBase';
import ActionMan from '../plumbing/ActionManBase';
import DataStore from '../plumbing/DataStore';
import deepCopy from '../utils/deepCopy';
import { getDataItem } from '../plumbing/Crud';
import NGO from './NGO';
import KStatus from './KStatus';
import { getDataLogData, pivotDataLogData } from '../plumbing/DataLog';
import SearchQuery from '../searchquery';
import ServerIO from '../plumbing/ServerIOBase';

class Branding extends DataClass {
	/** @type{String} Player background colour (#hex or HTML name) */
	backgroundColor;

	/** @type{String} Player background image URL **/
	backgroundImage;

	/** @type{String} Brand primary colour (#hex or HTML name) */
	color;

	/** @type{String} Brand secondary colour (#hex or HTML name) */
	color2;

	/** @type{String} TODO move custom css here from advert.advanced["customcss"] */
	customCss;

	/** @type{String} Not yet used in most places! */
	customHtml;

	/** @type{String} End card background colour (#hex or HTML name) */
	endCardBgColor;

	/** @type{String} End card background image URL **/
	endCardBgImage;
	/**
	 * @type{String} End card text colour (#hex or HTML name). Normally unset for
	 * use-the-brand-colour.
	 */
	endCardColor;

	/**
	 * @type{String} End card text colour (#hex or HTML name). Normally unset for
	 * use-the-brand-colour.
	 */
	tadgEndTheme;

	/** @type{String} Brand Facebook URL */
	fb_url;

	/**
	 * @type{String} Colour of highlighted adunit elements (countdown, locks etc) ??relation to
	 * color?
	 */
	highlightColor;

	/** @type{String} Brand Instagram URL */

	insta_url;
	/** @type{String} Brand logo URL */
	logo;

	/** @type{String} Brand logo URL (white silhouette for contrasting background) */
	logo_white;
	/** @type{String} Colour of adunit text ??relation to color? */
	textColor;
	/** @type{String} Brand Twitter URL */
	tw_url;

	/** @type{String} Brand YouTube URL */
	yt_url;

}

DataClass.register(Branding, "Branding"); 

/**
 * 
 * @param {DataClass} item 
 * @returns {?Branding} 
 */
Branding.get = item => item && item.branding;

export default Branding;
