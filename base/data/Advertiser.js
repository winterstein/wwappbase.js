/** Data model functions for the Advert data-type. */
import { assert, assMatch } from '../utils/assert';
import Enum from 'easy-enums';
import DataClass from './DataClass';
import C from '../CBase';
import ActionMan from '../plumbing/ActionManBase';
import DataStore, { getDataPath, getListPath } from '../plumbing/DataStore';
import deepCopy from '../utils/deepCopy';
import { getDataItem, getDataList } from '../plumbing/Crud';
import NGO from './NGO';
import KStatus from './KStatus';
import { getDataLogData, pivotDataLogData } from '../plumbing/DataLog';
import SearchQuery from '../searchquery';
import ServerIO from '../plumbing/ServerIOBase';
import Branding from './Branding';
import Campaign from './Campaign';
import List from './List';
import PromiseValue from '../promise-value';

const type = 'Advertiser';


/**
 * See Advertiser.java
 */
class Advertiser extends DataClass {
}
DataClass.register(Advertiser, type);
export default Advertiser;


/**
 * 
 * @param {!String} vertiserId 
 * @param {?KStatus} status 
 * @returns {PromiseValue} List<Advertiser>
 */
Advertiser.getChildren = (vertiserId, status = KStatus.PUBLISHED) => {
	const q = SearchQuery.setProp(null, 'parentId', vertiserId).query;
	return getChildrenCommon(q, status);
};


/**
 * Get the child brands of multiple advertisers at once
 * @param {*} vertiserIds 
 * @param {*} status 
 */
Advertiser.getManyChildren = (vertiserIds, status = KStatus.PUBLISHED) => {
	const q = SearchQuery.setPropOr(new SearchQuery(), 'parentId', vertiserIds).query;
	return getChildrenCommon(q, status);
};


function getChildrenCommon(q, status) {
	const params = {type, status, q, save: true}
	if (status === KStatus.PUBLISHED) params.access = 'public';
	return getDataList(params);
}


/**
 * Includes from sub-brands
 * @param {*} p
 * @returns 
 */
Advertiser.getImpactDebits = ({vertiser, vertiserId, status=KStatus.PUBLISHED, start, end}) => {
	if (!vertiserId) vertiserId = vertiser.id;
	return DataStore.fetch(getListPath({type: C.TYPES.ImpactDebit, status, start, end, for:vertiserId}), () => {
		return getImpactDebits2(vertiser?.id || vertiserId, status, start, end);
	});
};


const getImpactDebits2 = async(vertiserId, status, start, end) => {
	// What if it's a master brand, e.g. Nestle > Nespresso?
	// The only way to know is to look for children
	let pvListAdvertisers = Advertiser.getChildren(vertiserId);
	let listAdvertisers = await pvListAdvertisers.promise; // ...wait for the results
	let vertiserIds = List.hits(listAdvertisers).map(adv => adv.id); // may be [], which is fine
	vertiserIds = vertiserIds.concat(vertiserId); // include the top-level brand
	const q = SearchQuery.setPropOr(null, 'vertiser', vertiserIds);
	let pvListImpDs = getDataList({type: 'ImpactDebit', status, start, end, q, save: true});
	let v = await pvListImpDs.promise;
	return v;
};
