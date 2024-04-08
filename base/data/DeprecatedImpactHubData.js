/*
WARNING: Everything in this file is deprecated and only kept for the old impact hub! DO NOT USE
*/

import { assert, assMatch } from '../utils/assert';
import Enum from 'easy-enums';
import DataClass from './DataClass';
import C from '../CBase';
import ActionMan from '../plumbing/ActionManBase';
import SearchQuery from '../searchquery';
import List from './List';
import DataStore, { getDataPath, getListPath } from '../plumbing/DataStore';
import deepCopy from '../utils/deepCopy';
import { getDataItem, getDataList, saveEdits } from '../plumbing/Crud';
import PromiseValue from '../promise-value';
import KStatus from './KStatus';
import Advert from './Advert';
import Advertiser from './Advertiser';
import Agency from './Agency';
import ServerIO, {normaliseSogiveId} from '../plumbing/ServerIOBase';
import { is, keysetObjToArray, uniq, uniqById, yessy, mapkv, idList, sum, getUrlVars } from '../utils/miscutils';
import { asDate } from '../utils/date-utils';
import { getId } from './DataClass';
import NGO from './NGO';
import Money from './Money';
import Branding from './Branding';
import XId from './XId';

import Campaign from './Campaign';

/**
 * @deprecated
* @param {!Campaign} campaign 
* @returns {!Object} {type, id} a stub object for the master agency/advertiser, or {}. 
* NB: advertiser takes precedence, so you can usefully call this on a leaf campaign.
* NB: {} is to support `let {type, id} = Campaign.masterFor()` without an NPE
*/
Campaign.masterFor = campaign => {
	Campaign.assIsa(campaign);
	if (campaign.vertiser) return {type:C.TYPES.Advertiser, id:campaign.vertiser};
	if (campaign.agencyId) return {type:C.TYPES.Agency, id:campaign.agencyId};
	return {};
};

/**
 * @deprecated
* HACK: access=public
* @param {Object} obj
* @param {!Campaign} obj.campaign 
* @param {?SearchQuery | string} obj.query
* @returns PV(List<Campaign>) Includes campaign! Beware when recursing
*/
Campaign.pvSubCampaigns = ({campaign, query}) => {
	Campaign.assIsa(campaign);
	if ( ! campaign.master) {
		return new PromiseValue(new List([campaign]));
	}
	// fetch leaf campaign
	let {id, type} = Campaign.masterFor(campaign);
	// campaigns for this advertiser / agency
	let sq = SearchQuery.setProp(query, C.TYPES.isAdvertiser(type)? "vertiser" : "agencyId", id);
	// exclude this? No: some (poorly configured) master campaigns are also leaves
	// sq = SearchQuery.and(sq, "-id:"+campaign.id);
	const access = "public"; // HACK allow Impact Hub to fetch an unfiltered list
	const pvCampaigns = getDataList({type: C.TYPES.Campaign, status:KStatus.PUBLISHED, q:sq.query, access});
	// NB: why change sub-status? We return the state after this campaign is published (which would not publish sub-campaigns)
	return pvCampaigns;
};


/**
* @deprecated
* This is the total unlocked across all adverts in this campaign. See also maxDntn.
* Warning: This will change as data loads!!
* @returns {?Money}
*/
Campaign.dntn = (campaign, isSub) => {
	// Reduce code paths: just collapse the result of dntn4charity.
	const d4c = Campaign.dntn4charity(campaign, isSub);
	if (!d4c) return null;
	return Object.values(d4c).reduce((acc, val) => {
		return acc ? Money.add(acc, val) : val;
	}, null);
};


/**
* Recursive and fetches dynamic data.
* @deprecated
* @param {Campaign} campaign
* @param {boolean} [isSub] set in recursive calls
* @returns {Object} {cid: Money} Values may change as data loads
* @see Campaign.dntn
*/
Campaign.dntn4charity = (campaign, isSub) => {
	assert(!isSub || isSub === true, `Campaign.dntn4charity called with ambiguous value for isSub arg: ${isSub}`);
	Campaign.assIsa(campaign);

	// Leaf campaigns
	// Hard-set values on campaigns only.
	// Removed all realtime code - depends on /datafn/donations endpoint which is deprecated & doesn't rerurn trustworthy data
	if (!campaign.master || isSub) {
		return Object.assign({}, campaign.dntn4charity);
	}

	// Master campaigns: recurse over leaf campaigns & sum
	if (!isDntn4CharityEmpty(campaign.dntn4charity)) {
		console.warn("Ignoring master.dntn4charity - it should not be set for masters 'cos it can confuse sums for e.g. reporting by-charity in T4G", campaign);
	}

	let pvSubs = Campaign.pvSubCampaigns({campaign});
	if (!pvSubs.value) return {};

	let subs = List.hits(pvSubs.value);
	let dntn4charitys = subs.map(sub => Campaign.dntn4charity(sub, true));

	// aggregate d4c for subcampaigns
	let subtotal4c = {};
	for (let i = 0; i < dntn4charitys.length; i++) {
		const subd4c = dntn4charitys[i];
		mapkv(subd4c, (k,v) => {
			let old = subtotal4c[k];
			subtotal4c[k] = old ? Money.add(old, v) : v;
		});
	}

	return subtotal4c;
};


/**
 * @deprecated
 * FIXME Get a list of charities for a campaign
 * @param {Object} p 
 * @param {Campaign} p.campaign 
 * @param {KStatus} p.status The status of ads and sub-campaigns to fetch
 * @returns {NGO[]} May change over time as things load!
 */
Campaign.charities = (campaign, status=KStatus.DRAFT, isSub) => {
	Campaign.assIsa(campaign);
	KStatus.assert(status);
	// charities listed here
	let charityIds = [];
	if (campaign.strayCharities) charityIds.push(...campaign.strayCharities);
	if (campaign.dntn4charity) charityIds.push(...Object.keys(campaign.dntn4charity));
	if (campaign.localCharities) charityIds.push(...Object.keys(campaign.localCharities));

	let pvAds = Campaign.pvAdsLegacy({campaign, status});
	if ( ! pvAds.value) {
		return charities2(campaign, charityIds, []);
	}
	let ads = List.hits(pvAds.value);
	if ( ! ads.length) console.warn("No Ads?!", campaign, status);
	// individual charity data, attaching ad ID
	let vcharitiesFromAds = charities2_fromAds(ads);
	// apply local edits
	return charities2(campaign, charityIds, vcharitiesFromAds);
}; // ./charities()

/**
 * @deprecated
 * @param {!Campaign} campaign 
 * @param {?String[]} charityIds 
 * @param {!NGO[]} charities 
 * @returns {NGO[]}
 */
const charities2 = (campaign, charityIds, charities) => {
	Campaign.assIsa(campaign);
	// fetch NGOs
	if (yessy(charityIds)) {
		assMatch(charityIds, "String[]");
		// TODO SoGive stores id as @id, which messes this up :(
		// @id is the thing.org "standard", but sod that, its daft - We should switch SoGive to `id`
		charityIds.forEach(cid => {
			let pvSoGiveCharity = getDataItem({type: C.TYPES.NGO, status:KStatus.PUBLISHED, id:cid, swallow:true});
			// Add them as they load (assume this function gets called repeatedly)
			if (pvSoGiveCharity.value) {
				charities.push(pvSoGiveCharity.value);
			}
		});
	}
	// merge and de-dupe
	let charityForId = {};
	if (campaign.localCharities) {
		Object.entries(campaign.localCharities).map(([k,v]) => {
			if ( ! v.id) v.id = k; // No Id?! Seen Sep 2021
			charityForId[k] = v;
		});
	}
	charities.map(c => {
		NGO.assIsa(c);
		charityForId[getId(c)] = Object.assign({}, c, charityForId[getId(c)]); // NB: defensive copies, localCharities settings take priority
	});
	// any missing? Put in a blank
	charityIds.forEach(cid => {
		if (charityForId[cid]) return;
		charityForId[cid] = new NGO({id:cid}); 
	});
	let cs = Object.values(charityForId);
	// tag with campaign info (helpful when tracing, overlaps may mean this isnt the full list)
	cs.map(cMerged => {
		let allCampaigns = (cMerged._campaigns || []).concat(cMerged._campaigns).concat(campaign.id);
		cMerged._campaigns = uniq(allCampaigns);
	});
	return cs;
};

/**
 * @deprecated
 * @param {*} ads 
 */
const charities2_fromAds = (ads) => {
	// individual charity data, attaching ad ID
	let charities = _.flatten(ads.map(ad => {
		if (!ad.charities) return [];
		const clist = (ad.charities && ad.charities.list).slice() || [];
		return clist.map(c => {
			if ( ! c) return null; // bad data paranoia
			const cid = getId(c);
			if ( ! cid || cid==="unset" || cid==="undefined" || cid==="null" || cid==="total") { // bad data paranoia						
				// console.error("Campaign.js charities - Bad charity ID", c.id, c);
				return null;
			}
			const id2 = normaliseSogiveId(cid);
			if (id2 !== cid) {
				c.id = id2;
			}
			c._adId = ad.id; // for Advert Editor dev button so sales can easily find which ad contains which charity
			return c;
		}); // ./clist.map
	}));
	charities = uniqById(charities);
	return charities;
};

/**
 * @deprecated
 * @param {*} campaign 
 */
Campaign.isOngoing = campaign => {
	let end = Campaign.end(campaign);
	if (end) {
		return end.getTime() > new Date().getTime();
	}
	// old data?
	return campaign.ongoing;
};

/**
 * @deprecated only retained so we can detect and filter out old master campaigns
 * @param {!Campaign} campaign 
 * @returns {boolean} NB: false for the TOTAL_IMPACT root 
 */
Campaign.isMaster = campaign => Campaign.assIsa(campaign) && campaign.master;


/**
 * @deprecated
 * @param {!Campaign} campaign 
 * @returns {?String[]} ids to hide
 */
Campaign.hideCharities = campaign => {
	Campaign.assIsa(campaign);
	let hc = campaign.hideCharities;
	if ( ! hc) return null;

	// hideCharities is from a KeySet prop control, so is an object of schema {charity_id : bool}.
	// We want to convert it instead to a list of charity IDs
	if (Array.isArray(hc)) {
		return hc;
	}
	// Convert object to array
	let hideCharitiesArr = Object.keys(hc);
	// Remove false entries - keySet will not remove charity IDs, but set them to false instead.
	hideCharitiesArr = hideCharitiesArr.filter(cid => hc[cid]);
	return hideCharitiesArr;
};

/**
 * @deprecated
 * Get the list of ad IDs that this campaign will hide
 * NB: While you can merge the hideAds list with other campaigns, this is not used within the Impact Hub,
 * for simplicity of only having one list to manage instead of multiple across multiple campaigns
 * @param {Campaign} topCampaign 
 * @param {?Campaign[]} campaigns other campaigns to merge with
 * @returns {!String[]} hideAdverts IDs
 */
Campaign.hideAdverts = (topCampaign, campaigns) => {
	Campaign.assIsa(topCampaign);
	// Merge all hide advert lists together from all campaigns
	let allHideAds = topCampaign.hideAdverts ? keysetObjToArray(topCampaign.hideAdverts) : [];
	if (campaigns) {
		campaigns.forEach(campaign => allHideAds.push(... campaign.hideAdverts ? keysetObjToArray(campaign.hideAdverts) : []));
	}
	// Copy array
	const mergedHideAds = allHideAds.slice();
	return mergedHideAds;
}

/**
 * @deprecated
* Get (and cache) all ads associated with the given campaign. This will apply hide-list and never-served filters 
* @param {Object} p 
* @param {Campaign} p.campaign 
* @param {?KStatus} p.status
* @param {?String} p.query Filter by whatever you want, eg data
* @returns PromiseValue(List(Advert)) HACK Adverts get `_hidden` added if they're excluded.
*/
Campaign.pvAdsLegacy = ({campaign,status=KStatus.DRAFT,query}) => {
	let pv = DataStore.fetch(['misc','pvAds',status,query||'all',campaign.id], () => {
		return pAds2({campaign,status,query});
	});
	return pv;
};

/**
 * HACK: access=public
 * NB: This function does chained promises, so we use async + await for convenience.
 * @returns Promise List(Advert) All ads -- hidden ones are marked with a truthy `_hidden` prop
 */
const pAds2 = async function({campaign, status, query, isSub}) {
	Campaign.assIsa(campaign);
	if (campaign.master && ! isSub) { // NB: a poorly configured campaign can be a master and a leaf
		// Assume no direct ads
		// recurse
		const pvSubs = Campaign.pvSubCampaigns({campaign});
		let subsl = await pvSubs.promise;
		let subs = List.hits(subsl);
		let AdListPs = subs.map(sub => {
			let pSubAds = pAds2({campaign:sub, status:KStatus.PUBLISHED, query, isSub:true});
			return pSubAds;
		});
		let adLists = await Promise.all(AdListPs);
		let ads = [];
		adLists.forEach(adl => ads.push(...List.hits(adl)));
		// adds can be hidden at leaf or master
		pAds3_labelHidden({campaign, ads});

		const list = new List(ads);
		sortAdsList(list);
		return list;
	}

	// leaf campaign
	// fetch ads
	let sq = SearchQuery.setProp(null, "campaign", campaign.id);
	if (query) sq = SearchQuery.and(sq, new SearchQuery(query));
	// ...HACK allow Impact Hub to fetch an unfiltered but cleansed list
	//    But not for previews, as access=public cannot read DRAFT
	const access = status==KStatus.PUBLISHED? "public" : null; 
	// ...fetch
	const pvAds = ActionMan.list({type: C.TYPES.Advert, status, q:sq.query, access});
	let adl = await pvAds.promise;
	List.assIsa(adl);
	sortAdsList(adl);

	// Label ads using hide list and non-served
	let ads = List.hits(adl);
	pAds3_labelHidden({campaign, ads});

	return adl;
};

const pAds3_labelHidden = ({campaign, ads}) => {
	// manually hidden
	const hideAdverts = Campaign.hideAdverts(campaign);
	for (let hi = 0; hi < hideAdverts.length; hi++) {
		const hadid = hideAdverts[hi];
		const ad = ads.find(ad => ad.id === hadid);
		if (ad) {
			ad._hidden = campaign.id; // truthy + tracks why it's hidden
		}
	}
	// non served
	if (campaign.showNonServed) {
		return;
	}
	ads.forEach(ad => {
		if ( ! ad.hasServed && ! ad.serving) {
			ad._hidden = "non-served";
		}
	});
};

/** Newest first. Safe default for pretty much everywhere here. */
const sortAdsList = adsList => adsList.hits.sort((a, b) => {
	if (a.created === b.created) return 0;
	return a.created < b.created ? 1 : -1;
});

/**
 * @deprecated
 * @param {Object} p
 * @param {?Money} p.donationTotal
 * @param {NGO[]} p.charities From adverts (not SoGive)
 * @param {Object} p.donation4charity 
 * @returns {NGO[]}
 */
Campaign.filterLowDonations = ({charities, campaign, donationTotal, donation4charity}) => {

	// Low donation filtering data is represented as only 2 controls for portal simplicity
	// lowDntn = the threshold at which to consider a charity a low donation
	// hideCharities = a list of charity IDs to explicitly hide - represented by keySet as an object (explained more below line 103)

	// Filter nulls and null-ID bad data
	charities = charities.filter(x => x && x.id);

	if (campaign.hideCharities) {
		let hc = Campaign.hideCharities(campaign);
		const charities2 = charities.filter(c => ! hc.includes(normaliseSogiveId(getId(c))));
		charities = charities2;
	}

	let lowDntn = campaign.lowDntn;
	if ( ! lowDntn || ! Money.value(lowDntn)) {
		if ( ! donationTotal) {
			return charities;
		}
		// default to 0
		lowDntn = new Money({currency:donationTotal.currency, value:0});
	}

	/**
	 * @param {!NGO} c 
	 * @returns {?Money}
	 */
	const getDonation = c => {
		let d = donation4charity[c.id] || donation4charity[c.originalId]; // TODO sum if the ids are different
		return d;
	};

	charities = charities.filter(charity => {
		const dntn = getDonation(charity);
		let include = dntn && Money.lessThan(lowDntn, dntn);
		return include;
	});
	return charities;
} // ./filterLowDonations


/**
 * @deprecated
 * @param {Object} d4c {charity-id: Money}
 * @returns 
 */
const isDntn4CharityEmpty = (d4c) => {
	if ( ! d4c) return true;
	let nonEmpty = Object.values(d4c).find(v => v && Money.value(v));
	return ! nonEmpty;
}

/** 
 * @param q {String} e.g. pub:myblog cid:mycharity campaign:mycampaign
 * @returns Promise {
 * 	by_cid: {String: Money}
 * 	total: {Money},
 * 	stats: {}
 * }
 * @param {?String} name Just for debugging - makes it easy to spot in the network tab 
 */
ServerIO.getDonationsData = ({q, start, end, name}) => {
	let url = ServerIO.PORTAL_ENDPOINT+'/datafn/donations';
	const params = {
		data: {name, q, start, end}
	};
	return ServerIO.load(url, params);
};

/**
 * Get the viewcount for a campaign, summing the ads (or using the override numPeople)
 * @param {Object} p
 * @param {Campaign} p.campaign 
 * @returns {Number}
 */
Campaign.viewcountDeprecated = ({campaign, status}) => {
	// manually set?
	if (campaign.numPeople) {
		return campaign.numPeople;
	}
	const pvAllAds = Campaign.pvAdsLegacy({campaign, status});
	const allAds = List.hits(pvAllAds.value) || [];
	const viewcount4campaign = Advert.viewcountByCampaign(allAds).value;
	if (!viewcount4campaign) return 0;
	return sum(Object.values(viewcount4campaign));;
};

export default Campaign;
