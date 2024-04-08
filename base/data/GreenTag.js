/*
NB Why don't we use url.searchParams.set(k, v) to add params when generating tag exports?
A: Because whenever you invoke searchParams.set(), it parses all params and makes sure they're URL-encoded
...which ruins any attempt you've made up to that point to preserve macro delimiters like ${MACRO} and %%MACRO%%.
We use it ONCE when applying the dataspace param, to cleanly make sure the URL has its ? - and then append raw text subsequently.
*/
import DataClass from './DataClass';
import Enum from 'easy-enums';
import { encURI } from '../utils/miscutils';
import { getDataList } from '../plumbing/Crud';
import SearchQuery from '../searchquery';

const KGreenTagType = new Enum('PIXEL JAVASCRIPT REDIRECT WRAPPER');
const KMacroType = new Enum('NONE DV360 CM360 GOOGLE TTD XANDR YAHOO AMAZON');

/** Used by Green Ad Tag generator */
const REDIRECT_BASE = `${C.HTTPS}://${C.SERVER_TYPE}lg.good-loop.com/lg?t=redirect`;
const PIXEL_BASE = `${C.HTTPS}://${C.SERVER_TYPE}lg.good-loop.com/pxl.png?t=pixel`;
const WRAPPER_BASE = `${C.HTTPS}://${C.SERVER_TYPE}as.good-loop.com/greenvast.xml`;

/** When URL-encoding URLs - eg for redirect tags - use these regexes to separate and preserve macros in the target URL, so the user's DSP can process them. */
const macroRegexes = {
	[KMacroType.DV360]: /(\$\{\w+\})/g, // eg ${CREATIVE_ID}
	[KMacroType.CM360]: /(%\w+!?)/g, // eg %s or %esid!
	[KMacroType.GOOGLE]: /(%%\w+%%)/g, // eg %%SITE%%
	[KMacroType.TTD]: /(%%\w+%%)/g, // eg %%TTD_CREATIVE_ID%%
	[KMacroType.XANDR]: /(\$\{\w+\})/g, // eg ${CREATIVE_ID}
	[KMacroType.YAHOO]: /(\{\w+:?\w*\})/g, // eg {param:default}
	[KMacroType.AMAZON]: /(\_\_\w+\_\_)/g, // eg __CS_AD_NAME__
	//[KMacroType.QUANTCAST]: /(\[%\w+%\])/g // eg [%orderid%] left out for now - cant find Quantcast specific ad macros??
};

/** Split out macros and preserve delimiters before URL-component-encoding the rest */
const encodePreserveMacros = (targetUrl, macroType) => {
	const macroRegex = macroRegexes[macroType];
	if (!macroRegex) return encodeURIComponent(targetUrl);

	return targetUrl.split(macroRegex).reduce((acc, bit) => {
		if (bit.match(macroRegex)) return acc + bit;
		return acc + encodeURIComponent(bit);
	}, '');
};

// search vs searchParams: see comment at top
const macroAdders = {
	[KMacroType.DV360]: (url) => {
		// creative ID, site url
		// TODO PUBLISHER_ID and UNIVERSAL_SITE_ID?? Let's log them (harmlessly) so we can see https://support.google.com/displayvideo/answer/2789508?hl=en
		url.search += '&macro=dv360&vert=${CREATIVE_ID}&url=${SOURCE_URL_ENC}&pid=${PUBLISHER_ID}&usi=${UNIVERSAL_SITE_ID}';
	},
	[KMacroType.CM360]: (url) => {
		// 
		// https://support.google.com/campaignmanager/table/6096962?hl=en#server
		url.search += '&macro=cm360&pid=%s,%esid!&vert=%ecid!';
	},
	[KMacroType.GOOGLE]: (url) => {
		// width, height, site domain, site url
		// https://support.google.com/admanager/answer/2376981?hl=en
		url.search += '&macro=gam&width=%%WIDTH%%&height=%%HEIGHT%%&pub=%%SITE%%&url=%%REFERRER_URL_ESC%%';
	},
	[KMacroType.TTD]: (url) => {
		// creative ID, size string, device type, site domain
		// https://www.reddit.com/r/adops/comments/aibke3/inserting_macros_into_the_trade_desk_tracker_url/
		// https://www.reddit.com/r/adops/comments/mz8w2l/ttd_dv360_and_mediamath_macros/
		url.search += '&macro=ttd&vert=%%TTD_CREATIVEID%%&size=%%TTD_ADFORMAT%%&env=%%TTD_DEVICETYPE%%&pub=%%TTD_SITE%%';
	},
	[KMacroType.XANDR]: (url) => {
		// creative ID, size string, width, height, site URL
		// (TODO reinstate somehow) Removed "&pub=${SITE_ID}" as it was polluting records with numeric values, xandr does not have a "site domain" macro
		// https://docs.xandr.com/bundle/invest_invest-standard/page/topics/supported-creative-macros.html
		url.search += '&macro=xandr&vert=${CREATIVE_ID}&size=${CREATIVE_SIZE}&width=${WIDTH}&height=${HEIGHT}&url=${REFERER_URL_ENC}&site_id=${SITE_ID}';
	},
	[KMacroType.YAHOO]: (url) => {
		// creative ID, device type TODO pub/domain?!
		// https://developer.yahooinc.com/native/guide/v1-api/dynamic-parameters.html "Tracking Macros" session suggests these are only for clickthrough URLs
		url.search += '&macro=yahoo&vert={creative}&env={device}';
	},
	[KMacroType.AMAZON]: (url) => {
		// doc - maybe this?? https://advertising.amazon.com/en-gb/resources/ad-policy/mmp-measurement-urls
		// Has this been tested??
		// creative ID, size string
		url.search += '&macro=amzn&vert=__CS_CREATIVE_ID__&size=__CS_AD_SIZE__&pub=__AAX_SITE_NAME__'
	},
};

/**
 * 
 * @param {!URL} url modifies this
 * @param {!GreenTag} tag 
 * @returns null
 */
const setBaseParams = (url, tag) => {
	url.searchParams.set('d', 'green'); // "green ad tag" dataspace

	// search vs searchParams: see comment at top
	if (tag.campaign) url.search += `&campaign=${encURI(tag.campaign)}`;
	if (tag.id) url.search += `&adid=${tag.id}`;
	if (tag.vertiser) url.search += `&vertiser=${encURI(tag.vertiser)}`;
	if (tag.agencyId) url.search += `&agency=${encURI(tag.agencyId)}`;
	url.search += `&ow=1&uniq=1`; // overwrite for faster server-side save
	// NB: add macros after the base info in case the macros break the url (eg the user puts the wrong macros for the dsp)
	if (tag.macroType && macroAdders[tag.macroType]) {
		macroAdders[tag.macroType](url);
	}
};


/**
 * string -> function: tag -> string
 */
const generators = {
	PIXEL: (tag) => {
		const url = new URL(PIXEL_BASE);
		setBaseParams(url, tag);
		return `<img src="${url.toString()}" style="position:absolute;">`;
	},
	JAVASCRIPT: (tag) => {
		const url = new URL(PIXEL_BASE);
		setBaseParams(url, tag);
		// Why is this a fetch in js, and not a <script src={url.js}> tag (which would potentially allow for more data to be collected)??
		return `<script type="text/javascript">var x=new XMLHttpRequest();x.open('GET', '${url.toString()}');x.send()</script>`;
	},
	REDIRECT: (tag) => {
		const url = new URL(REDIRECT_BASE);
		setBaseParams(url, tag);
		// search vs searchParams: see comment at top
		url.search += `&link=${encodePreserveMacros(tag.wrapped, tag.macroType)}`; // add destination URL
		return url.toString();
	},
	WRAPPER: (tag) => {
		const url = new URL(WRAPPER_BASE);
		setBaseParams(url, tag);
		return url.toString();
	}
};


/**
 */
class GreenTag extends DataClass {
	constructor(base) {
		super();
		DataClass._init(this, base);

		if (!this.tagType) this.tagType = KGreenTagType.PIXEL;
		if (!this.macroType) this.macroType = KMacroType.NONE;
	}

	/** User-recognisable name */
	name;
	/** Campaign to group impressions for multiple tags */
	campaign;
	/** Whose adverts are we measuring? */
	vertiser;
	/** Which organisation is managing these tags? */
	agencyId;
	/** Tag type, e.g. pixel, redirect, VAST wrapper */
	tagType;
	/** Macro type for target DSP, e.g. google, xandr */
	macroType;
	/** (For WRAPPER and REDIRECT tagType) The user's original tag which this wraps/redirects */
	wrapped;
	/** URL to the tagged advert's VAST tag or uploaded creative zip */
	creativeURL;
	creativeHtml;
	/** The generated tag URL */
	tag;
	/** The size (in bytes) of the creative this tag represents */
	weight;
	/** For holding notes info. TODO: maybe move somewhere else? */
	notes;
}

GreenTag.generate = (tag) => {
	const generator = generators[tag.tagType] || generators.PIXEL;
	return generator(tag);
}


GreenTag.fetchForAdvertiser = ({id, status, q}) => GreenTag.fetchFor('vertiser', id, status, q);
GreenTag.fetchForAdvertisers = ({ids, status, q}) => GreenTag.fetchFor('vertiser', ids, status, q);

GreenTag.fetchForCampaign = ({id, status, q}) => GreenTag.fetchFor('campaign', id, status, q);
GreenTag.fetchForCampaigns = ({ids, status, q}) => GreenTag.fetchFor('campaign', ids, status, q);


/**
 * Common functionality across fetchForAdvertiser(s) / fetchForCampaign(s).
 * @param {string} typeKey The member to construct a match-ID query on, eg "vertiser" for q=vertiser:xxxxx
 * @param {string|string[]} ids ID or list of IDs that advert[typeKey] should match
 * @param {KStatus} [status] Status of adverts to fetch
 * @param {SearchQuery|string} [rawQ] A search query - if given, will be augmented with ID list
 */
GreenTag.fetchFor = (typeKey, ids, status = KStatus.PUBLISHED, rawQ) => {
	if (!Array.isArray(ids)) ids = [ids];
	if ( ! ids || ! ids.length) {
		return []; // empty list
	}
	const q = SearchQuery.setPropOr(rawQ, typeKey, ids);
	return getDataList({ type: C.TYPES.GreenTag, status, q, save: true });
};

DataClass.register(GreenTag, "GreenTag");
const This = GreenTag;
export default GreenTag;

export { KGreenTagType, KMacroType, macroAdders };
