/** Data model functions for the Advert data-type. */
import { assert, assMatch } from '../utils/assert';
import Enum from 'easy-enums';
import DataClass from './DataClass';
import C from '../CBase';
import ActionMan from '../plumbing/ActionManBase';
import DataStore, { getListPath } from '../plumbing/DataStore';
import deepCopy from '../utils/deepCopy';
import { getDataItem, getDataList } from '../plumbing/Crud';
import NGO from './NGO';
import KStatus from './KStatus';
import { getDataLogData, pivotDataLogData } from '../plumbing/DataLog';
import SearchQuery from '../searchquery';
import ServerIO from '../plumbing/ServerIOBase';
import Branding from './Branding';
import PromiseValue from '../promise-value';
import { isEmpty } from 'lodash';

const type = C.TYPES.Advert;

/**
 * See Advert.java
 */
class Advert extends DataClass {
	/** @type{String} */
	vertiser;

	/** @type{Branding} */
	branding;

	/**
	 * @param {Advert} base 
	 * @param {!String} base.vertiser Advertiser id
	 */
	constructor(base) {
		super();
		assMatch(base.vertiser, String, "Advert.js make() - no vertiser ID", base);		
		// copy CTA??, legacyUnitBranch, variant info, and onX pixels (but nothing else, eg id name etc) from the default
		let dad = Advert.defaultAdvert();
		Object.assign(this, {legacyUnitBranch:dad.legacyUnitBranch, variantSpec: deepCopy(dad.variantSpec)});
		// ..copy default onX pixels
		if (dad.advanced) {
			if ( ! this.advanced) this.advanced = {};
			Object.keys(dad.advanced).filter(k => k.startsWith("on")).forEach(k => this.advanced[k] = dad.advanced[k]);
		}
		// copy branding from the advertiser
		// NB: draft is more likely to be loaded into mem than published
		let pvAdvertiser = getDataItem({type: C.TYPES.Advertiser, id: base.vertiser, status: KStatus.DRAFT, swallow: true});
		if (pvAdvertiser.value && pvAdvertiser.value.branding) {
			this.branding = deepCopy(pvAdvertiser.value.branding);
		}

		// Are we currently running a release branch? Lock the new advert to the current branch.
		if (process.env.RELEASE_BRANCH) this.legacyUnitBranch = process.env.RELEASE_BRANCH;

		// NB: Don't copy campaign-page -- that gets dynamically sorted out by the My.GL ImpactHub
		// Now add in base
		DataClass._init(this, base);
	}
}
DataClass.register(Advert, 'Advert');

C.DEFAULT_AD_ID = 'default-advert';

/**
 * @returns {Advert}
 * Note: race condition on app loading - this will be null for a second.
 */
Advert.defaultAdvert = () => {
	let swallow = (C.SERVER_TYPE !== 'test' && C.SERVER_TYPE !== 'stage'); // NB: local will often fail; production shouldn't, but should fail quietly if it does
	const pvAd = getDataItem({type, id: C.DEFAULT_AD_ID, status: KStatus.PUBLISHED, swallow});
	return pvAd.value;
};

// HACK: trigger a data fetch if on Portal
if (window.location.hostname.includes('portal.good-loop.com')) {
	Advert.defaultAdvert();
}

/**
 * @param {!Advert} ad
 * @returns {!string}
 */
Advert.advertiserId = ad => Advert.assIsa(ad) && ad.vertiser;

/**
 * @param {!Advert} ad 
 * @returns {String} campaignId
 */
Advert.campaign = ad => ad.campaign;

/**
 * @param {!Advert} ad 
 * @returns {?Date}
 */
Advert.start = ad => ad.start && new Date(ad.start);

/**
 * @param {!Advert} ad 
 * @returns {?Date}
 */
Advert.end = ad => ad.start && new Date(ad.end);

Advert.campaign = ad => ad.campaign;

Advert.tags = ad => ad.tags;

Advert.served = ad => ad.hasServed || ad.serving;

Advert.hideFromShowcase = ad => ad.hideFromShowcase;

/**
 * @param {*} ad 
 * @param {*} impactSettings 
 * @returns {?string} undefined for "show dont hide". truthy for hide.
 * 	ad.id for hide. "non-served" for hide-because-not-served
 */
Advert.isHiddenFromImpact = (ad, impactSettings) => {
	assert(ad);
	if (ad.hideFromShowcase) return ad.id;
	if (impactSettings && !impactSettings.showNonServedAds && !Advert.served(ad)) return "non-served";
}

/**
 * @param {Advert} ad
 * @returns {!NGO[]}
 */
Advert.charityList = ad => {
	if (!ad.charities) ad.charities = {};
	if (!ad.charities.list) ad.charities.list = [];
	// WTF? we're getting objects like {0:'foo', 1:'bar'} here instead of arrays :( 
	if (!ad.charities.list.map) {
		console.warn('Advert.js - patching charity list Object to []');
		ad.charities.list = Object.values(ad.charities.list);
	}
	// null in list bug seen June 2020
	const clist = ad.charities.list.filter(c => c);
	if (clist.length < ad.charities.list.length) {
		console.warn('Advert.js - patching charity list null');
		ad.charities.list = clist;
	}
	return clist;
};

Advert.displaySize = advert => {
	assert(advert);
	return advert.displayBase?.size || null;
}


/**
 * @param {Advert[]} ads List of adverts
 * @returns {SearchQuery} DataLog query for "every minview event for any of the given ads"
 */
const viewCountQuery = ads => {
	const adsQuery = SearchQuery.setPropOr(null, 'vert', ads.map(ad => ad.id));
	return SearchQuery.and(adsQuery, 'evt:minview');
}

/**
 * Impressions 
 * @param {object} p
 * @param {Advert[]} p.ads
 * @returns {object<{String: Number}>} Mapping from ISO country code to viewcount
 */
Advert.viewcountByCountry = ({ads, start, end}) => Advert.viewcountBy({ads, start, end, bby: 'country'});

/**
 * @param {Advert[]} ads
 * @returns {object<{String: Number}>} Mapping from campaign ID to viewcount
 */
Advert.viewcountByCampaign = ads => Advert.viewcountBy({ads, bby: 'campaign'});


/**
 * Minviews-per-[bby] (eg country, campaign, etc) for all ads in a list
 * @param {object} p
 * @param {Advert[]} p.ads List of adverts to query on
 * @param {String} p.bby Breakdown on this parameter
 * @param {String} p.start Start date/time for query
 * @param {String} p.end End date/time for query
 * @returns {PromiseValue<object|null>} pv.value maps { key: viewcount4key }
 */
Advert.viewcountBy = params => {
	const processResult = res => pivotDataLogData(res, [params.bby]);
	return Advert.viewcountCommon({ ...params, processResult });
};


/**
 * Total minviews for all ads in a list
 * @param {object} p
 * @param {Advert[]} p.ads List of adverts to query on
 * @param {String} p.start Start date/time for query
 * @param {String} p.end End date/time for query
 * @returns {PromiseValue<Number|null>} pv.value = viewcount
 */
Advert.viewcount = params => {
	const processResult = res => res.allCount;
	return Advert.viewcountCommon({ ...params, processResult });
};


Advert.viewcountCommon = ({ads, start = '2017-01-01', end = 'now', bby, processResult}) => {
	if (!ads?.length) return new PromiseValue(null);

	// Namespace this fetch properly in DataStore
	const dataName = bby ? `view-data-by-${bby}` : 'view-data';

	// Get minview events for all ads in list
	const q = viewCountQuery(ads).query;
	return DataStore.fetch(['misc', 'DataLog', 'processed', 'Advert', dataName, q, JSON.stringify({start, end})], () => {
		const dataLogSpec = { name: dataName, dataspace: 'gl', breakdowns: [], q, start, end };
		// Add breakdown to query if present
		if (bby) Object.assign(dataLogSpec, { breakdowns: [bby] });
		// Fetch raw data and transform, if caller provided a function
		return getDataLogData(dataLogSpec).promise.then(res => (processResult ? processResult(res) : res));
	});
}


Advert.fetchForAdvertiser = ({vertiserId, status, q}) => Advert.fetchFor('vertiser', vertiserId, status, q);
Advert.fetchForAdvertisers = ({vertiserIds, status, q}) => Advert.fetchFor('vertiser', vertiserIds, status, q);

Advert.fetchForCampaign = ({campaignId, status, q}) => Advert.fetchFor('campaign', campaignId, status, q);
Advert.fetchForCampaigns = ({campaignIds, status, q}) => Advert.fetchFor('campaign', campaignIds, status, q);

/**
 * Common functionality across fetchForAdvertiser(s) / fetchForCampaign(s).
 * @param {string} typeKey The member to construct a match-ID query on, eg "vertiser" for q=vertiser:xxxxx
 * @param {string|string[]} ids ID or list of IDs that advert[typeKey] should match
 * @param {KStatus} [status] Status of adverts to fetch
 * @param {SearchQuery|string} [rawQ] A search query - if given, will be augmented with ID list
 * @returns {DataClass[]} can be empty
 */
Advert.fetchFor = (typeKey, ids, status = KStatus.PUBLISHED, rawQ) => {
	if (!Array.isArray(ids)) ids = [ids];
	if (isEmpty(ids)) return new PromiseValue([]); // No IDs, no adverts

	const q = SearchQuery.setPropOr(rawQ, typeKey, ids);
	const listParams = { type, status, q, save: true};
	if (status === KStatus.PUBLISHED) listParams.access = 'public';
	return getDataList(listParams);
};

// NB: banner=display
const KAdFormat = new Enum("display video social");

export default Advert;
export {
	KAdFormat
};
