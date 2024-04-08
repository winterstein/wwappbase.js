/** Data model functions for the Campaign data-type. */
import { assMatch } from '../utils/assert';
import DataClass from './DataClass';
import C from '../CBase';
import SearchQuery from '../../base/searchquery';
import List from './List';
import DataStore, { getListPath } from '../plumbing/DataStore';
import { getDataItem, getDataList, saveEdits } from '../plumbing/Crud';
import PromiseValue from '../promise-value';
import KStatus from './KStatus';
import Advert from './Advert';
import Advertiser from './Advertiser';

import { uniq } from '../utils/miscutils';
import { asDate } from '../utils/date-utils';
import Money from './Money';
import Branding from './Branding';
import XId from './XId';
import { isEmpty } from 'lodash';


const type = C.TYPES.Campaign;


/**
 * NB: in shared base, cos Portal and ImpactHub use this
 * 
 * See Campaign.java
 */
class Campaign extends DataClass {
	/** @type {?string} */
	id

	/** @type {?String} */
	agencyId;

	/** @type {?Branding} */
	branding;

	/** @type {?String} url */
	caseStudy;

	/** @type {?XId} Monday Deal */
	crm;

	/**
	 * @deprecated (kept for old data)
	 * @type {?boolean} */
	master;

	/** @type {?String} */
	vertiser;

	/** @type {?Money} */
	dntn;

	/** @type {?LineItem} */
	topLineItem;

	/**
	 * @param {Campaign} base 
	 */
	constructor(base) {
		super();
		DataClass._init(this, base);
	}
}
DataClass.register(Campaign, type);


/**
 * Special id for "everything!"
 */
Campaign.TOTAL_IMPACT = 'TOTAL_IMPACT';


/**
 * This is the DRAFT budget
 * @returns {Budget|null}
 */
Campaign.budget = item => {
	let tli = item?.topLineItem;
	return tli ? tli.budget : null;
};


/**
 * @returns {Date|null}
 */
Campaign.start = item => {
	const tli = item?.topLineItem;
	return tli ? asDate(tli.start) : null;
};


/**
 * @returns {Date|null}
 */
Campaign.end = item => {
	const tli = item?.topLineItem;
	return tli ? asDate(tli.end) : null;
}


/**
 * @param {Advert} advert
 * @param {KStatus} [status]
 * @returns {PromiseValue<Campaign|null>}
 */
Campaign.fetchFor = (advert, status = KStatus.DRAFT) => {
	let id = Advert.campaign(advert);
	// NB null must be wrapped because PromiseValue complains when given a nullish val directly
	if (!id) return new PromiseValue(Promise.resolve(null));
	return getDataItem({type, status ,id});
};


/**
 * Get all campaigns belonging to an advertiser
 * @param {string} vertiserId
 * @param {KStatus} [status]
 * @returns {PromiseValue<List<Campaign>>} May be empty
 */
Campaign.fetchForAdvertiser = (vertiserId, status = KStatus.DRAFT) => {
	return Campaign.fetchForAdvertisers([vertiserId], status);
}


/**
 * Get all campaigns belonging to any of a set of advertisers
 * @param {String[]} vertiserIds
 * @param {KStatus} [status]
 * @returns {PromiseValue<List<Campaign>>} May be empty
 */
Campaign.fetchForAdvertisers = (vertiserIds, status = KStatus.DRAFT) => {
	if (isEmpty(vertiserIds)) return new PromiseValue(new List());
	const listPath = getListPath({ type, status, for: `vertiser[]:${vertiserIds}` });

	return DataStore.fetch(listPath, () => {
		return Advertiser.getManyChildren(vertiserIds).promise
		.then(res => {
			const subBrandIds = List.hits(res).map(brand => brand.id);
			const allVertiserIds = uniq([ ...vertiserIds, ...subBrandIds ]);
			const q = SearchQuery.setPropOr(null, 'vertiser', allVertiserIds).query;
			const listParams = {type, status, q};
			if (status === KStatus.PUBLISHED) listParams.access = 'public';
			return getDataList(listParams).promise;
		});
	});
};


/**
 * Get all campaigns belonging to an agency.
 * @param {String} agencyId
 * @param {KStatus} [status]
 * @returns {PromiseValue<List<Campaign>>} May be empty
 */
Campaign.fetchForAgency = (agencyId, status = KStatus.DRAFT) => {
	if (!agencyId) return new PromiseValue(new List());
	const listPath = getListPath({ type, status, for: `agency:${agencyId}` });

	return DataStore.fetch(listPath, () => {
		// Two-stage fetch to catch campaigns which don't have their agency assigned
		// Find advertisers for the agency...
		const agencySQ = SearchQuery.setProp(null, 'agencyId', agencyId);
		const brandListParams = {type: C.TYPES.Advertiser, status, q: agencySQ.query};
		if (status === KStatus.PUBLISHED) brandListParams.access = 'public';
		return getDataList(brandListParams).promise
		.then(res => {
			// ...then find campaigns belonging to those advertisers, OR to the agency
			const vertiserIds = List.hits(res).map(v => v.id);
			const vertiserSQ = SearchQuery.setPropOr(agencySQ, 'vertiser', vertiserIds);
			const campaignListParams = {type, status, q: vertiserSQ.query};
			if (status === KStatus.PUBLISHED) campaignListParams.access = 'public';
			return getDataList(campaignListParams).promise;
		});
	});
};


/**
 * Create a new campaign for an advert
 * @param {Advert} advert
 * @returns {PromiseValue<Campaign>}
 */
Campaign.makeFor = (advert) => {
	const id = Advert.campaign(advert);
	assMatch(id, String, 'Campaign.makeFor bad input', advert);
	// NB: we can't fetch against the actual data path, as that could hit a cached previous failed fetchFor() PV
	// Which is OK -- crud's processing will set the actual data path
	return DataStore.fetch(['transient', 'Campaign', id], () => {
		// pass in the advertiser ID
		const { vertiser, vertiserName } = item;
		const item = { id, vertiser, vertiserName };
		return saveEdits({type, id, item});
	});
};


/**
 * Get the ImpactDebits for this campaign
 * @param {Object} p
 * @param {Campaign} p.campaign
 * @param {String} [p.campaignId]
 * @param {KStatus} [p.status]
 * @returns {PromiseValue<List<ImpactDebit>>}
 */
Campaign.getImpactDebits = ({campaign, campaignId, status = KStatus.PUBLISHED, start, end}) => {
	if (!campaignId) campaignId = campaign.id;
	const listPath = getListPath({ type: C.TYPES.ImpactDebit, status, start, end, for: `campaign:${campaignId}` });

	return DataStore.fetch(listPath, () => {
		let q = SearchQuery.setProp(null, 'campaign', campaignId);
		if (start) q = SearchQuery.setProp(q, 'start', start);
		if (end) q = SearchQuery.setProp(q, 'end', end);
		const listParams = {type: C.TYPES.ImpactDebit, status, q, save: true};
		if (status === KStatus.PUBLISHED) listParams.access = 'public';
		return getDataList(listParams).promise;
	});
};


/**
 * Get the viewcount for a campaign - either hardcoded as campaign.numPeople, or sum of viewcount for all campaign ads.
 * @param {Object} p
 * @param {Campaign} p.campaign
 * @param {KStatus} p.status
 * @returns {PromiseValue<Number>}
 */
Campaign.viewcount = ({campaign, status}) => {
	return DataStore.fetch(['misc', 'DataLog', 'processed', status, 'Campaign', 'viewcount', status, campaign.id], () => {
		// Hardcoded on the campaign?
		if (campaign.numPeople) return campaign.numPeople;
		// Fetch from DataLog: get all ads on this campaign...
		return Advert.viewcount({campaignId: campaign.id, status}).promise
		.then(res => {
			const ads = List.hits(res) || [];
			// Empty campaign - stop before Advert.viewcountByCampaign spams the console
			if (!ads?.length) return 0;
			return Advert.viewcount({ads}).promise || 0;
		});
	});
};


/**
 * Get the breakdown of views by country for a campaign.
 * @param {Object} p
 * @param {Campaign} p.campaign
 * @param {KStatus} p.status
 * @returns {PromiseValue<Object.<String, Number>>} May be empty
 */
Campaign.viewcountByCountry = ({campaign, status}) => {
	// No campaign = empty breakdown
	if (!campaign) return new PromiseValue({});

	return DataStore.fetch(['misc', 'DataLog', 'processed', status, 'Campaign', 'viewcountByCountry', status, campaign.id], () => {
		return Advert.fetchForCampaign({ campaignId: campaign.id, status }).promise
		.then(adsRes => {
			const ads = List.hits(adsRes);
			if (!ads?.length) return {}; // Empty campaign - stop before Advert.viewcountByCountry spams the console
			return Advert.viewcountByCountry({ ads }).promise;
			// Ad ID H4UMOFcV is sole ad for campaign 'One Baby One Tree'
		});
	});
};

export default Campaign;
