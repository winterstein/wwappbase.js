
import KStatus from './KStatus';
import List from './List';
import PromiseValue from '../promise-value';
import { getDataItem } from '../plumbing/Crud';
import C from '../../C';
import DataStore from '../plumbing/DataStore';
import SearchQuery from '../searchquery';
import { space, alphabetSort, noVal } from '../utils/miscutils';
import Campaign from './Campaign';
import Advertiser from './Advertiser';
import Advert from './Advert';
import Money from './Money';
import { assert } from '../utils/assert';
import ActionMan from '../plumbing/ActionManBase';
import { getId } from './DataClass';
import { isEmpty, maxBy, uniqBy } from 'lodash';


/**
 * HACK what is the main item this page is about?
 * @param {} baseObjects {campaign, brand, masterBrand}
 * @returns {?DataClass}
 */
export function getMainItem(baseObjects) {
	// TODO look at the url!
	if (!baseObjects) return null;
	let { campaign, brand, masterBrand } = baseObjects;
	return campaign || brand || masterBrand;
}


/**
 * Fetches the contextual data necessary to generate an impact page for a focus item
 * @param {Object} p
 * @param {String} p.id ID of the focus item
 * @param {String} p.type Type of the focus item
 * @param {KStatus} p.status
 * @returns {PromiseValue<Object>} {campaign, brand, masterBrand, subBrands, subCampaigns, impactDebits, charities, ads}
 */
export const fetchImpactBaseObjects = ({id, type, status, start, end}) => {
	assert(id);
	assert(type);
	assert(status);

	return DataStore.fetch(['misc', 'impactBaseObjects', type, status, space(start, end) || 'whenever', id], () => {
		return fetchImpactBaseObjects2({id, type, status, start, end});
	});
}


const fetchImpactBaseObjects2 = async ({id, type, status, start, end}) => {
	let pvCampaign, campaign;
	let pvBrand, brand, brandId;
	let pvMasterBrand, masterBrand;
	let pvSubBrands, subBrands;
	let pvSubCampaigns, subCampaigns;
	let pvImpactDebits, impactDebits;
	let pvCharities, charities;
	// let greenTags = [];
	let ads = [], wtdAds = [], etdAds = [], tadgAds = [];
	let subCampaignsDisplayable, subBrandsDisplayable;

	// Fetch campaign object if specified
	if (type === 'campaign' || type === C.TYPES.Campaign) {
		pvCampaign = getDataItem({type: C.TYPES.Campaign, status, id});
		campaign = await pvCampaign.promise;
		//if (pvCampaign.error) throw pvCampaign.error;
		// If we have a campaign, use it to find the brand
		brandId = campaign?.vertiser;
	} else if (type === 'brand' || type === C.TYPES.Advertiser) {
		// Otherwise use the URL
		brandId = id;
	}
	if (!brandId) {
		console.error('No advertiser ID', id, type);
		return {};
	}

	// Find the specified brand
	pvBrand = getDataItem({type: C.TYPES.Advertiser, status, id:brandId});
	brand = await pvBrand.promise;
	//if (pvBrand.error) throw pvBrand.error;
	if (brand.parentId) {
		// If this brand has a parent, get it
		pvMasterBrand = getDataItem({type: C.TYPES.Advertiser, status, id:brand.parentId});
		masterBrand = await pvMasterBrand.promise;
		//if (pvMasterBrand.error) throw pvMasterBrand.error;
	}
	// Find any subBrands of this brand (technically brands should only have a parent
	// OR children - but might be handy to make longer brand trees in future)
	pvSubBrands = Advertiser.getChildren(brand.id, status);
	subBrands = List.hits(await pvSubBrands.promise);

	// Look for sub-campaigns - if focus item isn't a campaign itself
	if (!campaign) {
		// Find all related campaigns to this brand
		pvSubCampaigns = Campaign.fetchForAdvertiser(brandId, status);
		subCampaigns = List.hits(await pvSubCampaigns.promise).filter(c => !Campaign.isMaster(c));

		// Look for vertiser wide debits
		pvImpactDebits = Advertiser.getImpactDebits({vertiser: brand, status, start, end});
		impactDebits = List.hits(await pvImpactDebits.promise);
	} else {
		// Get only campaign debits
		pvImpactDebits = Campaign.getImpactDebits({campaign, status, start, end});
		impactDebits = List.hits(await pvImpactDebits.promise);
	}

	// Simplifies having to add null checks everywhere
	if (!subBrands) subBrands = [];
	if (!subCampaigns) subCampaigns = [];
	if (!impactDebits) impactDebits = [];

	// If we aren't looking at a campaign, but this brand only has one - just pretend we are
	if (subCampaigns.length === 1) campaign = subCampaigns.pop();

	// Determine which items to fetch ads & green tags for:
	// If we're focused on a master brand, all of em.
	// If we're focused on a brand, just its child brands.
	// If we're focused on a campaign, just that campaign.
	let vertiserIds = campaign ? null : [brand, ...subBrands].map(b => b.id);
	let campaignIds = campaign ? [campaign.id] : subCampaigns.map(c => c.id);

	// Get the ads & green tags
	if (vertiserIds) {
		ads.push(...List.hits(await Advert.fetchForAdvertisers({vertiserIds, status}).promise));
		// greenTags.push(...List.hits(await GreenTag.fetchForAdvertisers({ids: vertiserIds, status}).promise));
	}
	if (campaignIds) {
		ads.push(...List.hits(await Advert.fetchForCampaigns({campaignIds, status}).promise));
		// greenTags.push(...List.hits(await GreenTag.fetchForCampaigns({ids: campaignIds, status}).promise));
	}

	// Collect, de-duplicate, and sort
	ads = uniqBy(ads, 'id');
	// we only care for ads that are actually part of campaigns & have ran before
	ads = ads.filter(ad => Advert.served(ad) && !ad.hideFromShowcase && campaignIds.includes(ad.campaign))

	ads.sort(alphabetSort);
	// greenTags = uniqBy(greenTags, 'id');
	// greenTags.sort(alphabetSort);

	// Divide ads into WTD, ETD and TADG
	ads.forEach(ad => {
		if (ad.advanced?.playerVariant === 'trees') {
			tadgAds.push(ad);
		} else if (ad.format === 'video') {
			wtdAds.push(ad);
		} else if (ad.format === 'social') {
			etdAds.push(ad);
		}
	});

	// Fetch charity objects from debits
	const charityIds = impactDebits.map(debit => debit.impact.charity).filter(x=>x);

	if (charityIds.length) {
		let charitySq = SearchQuery.setPropOr(null, "id", charityIds);
		pvCharities = ActionMan.list({type: C.TYPES.NGO, status, q:charitySq.query});
		charities = List.hits(await pvCharities.promise);
		console.warn("Placeholder fix for SoGive data id vs @id: https://good-loop.monday.com/boards/2603585504/pulses/4656061455/posts/2225457733?reply=reply-2225633150 ")
		charities = charities.map((charity) => {
			if(charity.id) return charity
			if(charity['@id']) charity.id = charity['@id']
			return charity
		})
	}

	if (!charities) charities = [];

	// If we've looked for both brand and campaign and found nothing, we have a 404
	if (!campaign && !brand) {
		throw new Error("404: Not found");
	}

	// Sorts charities augmented with a dntnTotal Money field
	const augCharityComparator = (a, b) => {
		if (a.dntnTotal && b.dntnTotal) return Money.sub(b.dntnTotal, a.dntnTotal).value;
		if (a.dntnTotal) return 1;
		if (b.dntnTotal) return -1;
		return 0;
	};

	// Attach donation total (sum of monetary ImpactDebits) to each charity & sort highest-first
	charities = charities.map(charity => {
		const cid = NGO.id(charity);
		const dntnTotal = impactDebits
			.filter(idObj => idObj?.impact?.charity === cid)
			.reduce((acc, idObj) => {
				const thisAmt = idObj?.impact?.amount;
				if (!acc) return thisAmt;
				if (!Money.isa(thisAmt)) return acc;
				return Money.add(acc, thisAmt);
			}, null);
		return {...charity, dntnTotal};
	}).sort(augCharityComparator);

	// Only campaigns/brands with debits and ads are displayable
	// Filter for debits
	let cidsWithDebits = [];
	let bidsWithDebits = [];
	impactDebits.forEach(debit => {
		if (debit.campaign && !cidsWithDebits.includes(debit.campaign)) cidsWithDebits.push(debit.campaign);
		if (debit.vertiser && !bidsWithDebits.includes(debit.vertiser)) bidsWithDebits.push(debit.vertiser);
	});
	subCampaignsDisplayable = subCampaigns.filter(c => cidsWithDebits.includes(getId(c)));
	subBrandsDisplayable = subBrands.filter(b => bidsWithDebits.includes(getId(b)));

	// Filter for ads
	let cidsWithAds = [];
	let bidsWithAds = [];
	ads.forEach(ad => {
		if (ad.campaign && !cidsWithAds.includes(ad.campaign)) cidsWithAds.push(ad.campaign);
		if (ad.vertiser && !bidsWithAds.includes(ad.vertiser)) bidsWithAds.push(ad.vertiser);
	});
	subCampaignsDisplayable = subCampaignsDisplayable.filter(c => cidsWithAds.includes(getId(c)));
	subBrandsDisplayable = subBrandsDisplayable.filter(b => bidsWithAds.includes(getId(b)));

	// Allow URL flag to override
	const showAll = DataStore.getUrlValue("showAll");
	if (showAll) {
		let cidsDisplay = subCampaignsDisplayable.map(c => getId(c));
		let bidsDisplay = subBrandsDisplayable.map(b => getId(b));
		// Go through and mark each item if it should be hidden normally
		subCampaigns.forEach(c => {
			if (!cidsDisplay.includes(getId(c))) {
				c._shouldHide = true;
				subCampaignsDisplayable.push(c);
			}
		});
		subBrands.forEach(b => {
			if (!bidsDisplay.includes(getId(b))) {
				b._shouldHide = true;
				subBrandsDisplayable.push(b);
			}
		});
	}

	return {
		campaign, subCampaigns, subCampaignsDisplayable,
		brand, masterBrand, subBrands, subBrandsDisplayable,
		impactDebits,
		charities,
		ads, wtdAds, etdAds, tadgAds,
		// greenTags // only used for the tick to show the client uses Green Tags. Not reliable 'cos e.g. IAS
	};
}


/**
 * Aggregate impressions-per-country for a campaign or group of subcampaigns
 * TODO Start and end params are unused
 * @param {object} p
 * @param {object} p.baseObjects See fetchImpactBaseObjects for structure
 * @param {Campaign} [p.baseObjects.campaign] The current focus campaign, if present
 * @param {Campaign[]} [p.baseObjects.subCampaigns] Campaigns belonging to the current focus object, if it's not a campaign itself
 * @param {Float} cutoff Interval (0, 1]. If region-impressions < (cutoff * totalImpressions), data is assigned to 'unset' region.
 * @returns {PromiseValue<object.<String, Number>>} Of form { [countryCode]: impressionCount }
 */
export const getImpressionsByCampaignByCountry = ({ baseObjects, start = '', end = 'now', locationField = 'country', cutoff=0.0, ...rest }) => {
	assert(baseObjects);
	let { campaign: focusCampaign, subCampaigns } = baseObjects;
	if (!focusCampaign && (!subCampaigns || subCampaigns.length == 0)) return {}; // No campaigns, no data

	// if focusCampaign is set, then the user has filtered to a single campaign (no subcampaigns)
	const campaigns = focusCampaign ? [focusCampaign] : subCampaigns;
	assert(campaigns);

	return DataStore.fetch(['misc', 'getImpressionsByCampaignByCountry', JSON.stringify(campaigns.map(c => getId(c)))], () => {
		// For each campaign, get a views-by-country breakdown
		const viewcountPredicate = (campaign) => (Campaign.viewcountByCountry({campaign, status: KStatus.PUBLISHED}).promise);
		// Collect all per-campaign promises & aggregate the views-by-country data
		return Promise.all(campaigns.map(viewcountPredicate))
		.then(viewsByCountryPerCampaign => {
			const region2totalViews = { unset: 0 };
			const region2campaignSet = { unset: {} };

			viewsByCountryPerCampaign.forEach((country2views, i) => {
				if (isEmpty(country2views)) return;
				const campaignId = getId(campaigns[i]);

				// Find the region (besides "unset") with the highest viewcount for this campaign
				// - Since we don't have explicit metadata for this, we'll say the campaign probably targeted that region
				const highestNotUnsetPredicate = ([country, viewCount]) => (country === 'unset') ? 0 : viewCount;
				let [tgtRegion, impressions] = maxBy(Object.entries(country2views), highestNotUnsetPredicate);

				// Special case - very tiny numbers of impressions are probably us doing testing & will incorrectly assign things to GB.
				// Let those campaigns be attributed to "unset".
				const campaignTotalViews = Object.values(country2views).reduce((acc, val) => acc + val, 0);
				if (tgtRegion === 'GB' && impressions < 200 && impressions < campaignTotalViews * 0.01) {
					[tgtRegion, impressions] = maxBy(Object.entries(country2views), ([country, viewCount]) => viewCount);
				}

				// Init viewcount tally and campaign-set, if needed
				if (noVal(region2totalViews[tgtRegion])) region2totalViews[tgtRegion] = 0;
				if (noVal(region2campaignSet[tgtRegion])) region2campaignSet[tgtRegion] = {};

				// Increment data for the campaign's target country
				region2totalViews[tgtRegion] += impressions;
				// ...and add this campaign to the set which targeted this country
				region2campaignSet[tgtRegion][campaignId] = true;

				// Assign rest of viewcount to "unset" (ie don't discard overspray - because it looks weird if numbers
				// don't add up to the stated total - but don't count it among intended views in a region)
				Object.entries(country2views).forEach(([otherRegion, otherImpressions]) => {
					if (otherRegion !== tgtRegion) region2totalViews.unset += otherImpressions;
				});
			});

			// Impressions cutoff to be considered significant - fraction of overall total
			const totalImpressions = Object.values(region2totalViews).reduce((total, impressions) => total + impressions, 0);
			const impressionsCutoff = cutoff * totalImpressions;

			// Reassign regions accounting for below-cutoff fractions of the total to "unset" (ie the "other regions" row)
			Object.entries(region2totalViews).forEach(([region, impressions]) => {
				if (impressions >= impressionsCutoff || region === 'unset') return;
				// Reassign impressions
				region2totalViews.unset += impressions
				delete region2totalViews[region]
				// Reassign campaigns
				Object.assign(region2campaignSet.unset, region2campaignSet[region]);
				delete region2campaignSet[region];
			});

			// Zip impressions-per-region and campaigns-per-region together
			const region2ViewsCampaigns = {};
			Object.entries(region2totalViews).forEach(([region, impressions]) => {
				const campaignsInRegion = Object.keys(region2campaignSet[region] || {}).length;
				region2ViewsCampaigns[region] = { impressions, campaignsInRegion };
			});
			return region2ViewsCampaigns;
		});
	});
};
