/** Data model functions for the Advert data-type. */
import { assert, assMatch } from '../utils/assert';
import Enum from 'easy-enums';
import DataClass from './DataClass';
import C from '../CBase';
import ActionMan from '../plumbing/ActionManBase';
import DataStore from '../plumbing/DataStore';
import deepCopy from '../utils/deepCopy';
import { getDataItem, getDataList } from '../plumbing/Crud';
import NGO from './NGO';
import KStatus from './KStatus';
import { getDataLogData, pivotDataLogData } from '../plumbing/DataLog';
import SearchQuery from '../searchquery';
import ServerIO from '../plumbing/ServerIOBase';
import Branding from './Branding';
import PromiseValue from '../promise-value';

const type = 'Agency';
/**
 * See Agency.java
 */
class Agency extends DataClass {
}
DataClass.register(Agency, type);
export default Agency;

/**
 * 
 * @param {!Agency} agencyId
 * @param {?KStatus} status 
 * @returns {PromiseValue} List<Agency>
 */
Agency.getChildren = (agencyId, status = KStatus.PUBLISHED) => {
	const q = SearchQuery.setProp(null, 'parentId', agencyId);
	const params = {type, status, q, save: true};
	// NB: see https://good-loop.monday.com/boards/2603585504/pulses/4684874791
	if (status === KStatus.PUBLISHED) params.access = 'public';
	return getDataList({type, status, q, save:true});
};

Agency.getImpactDebits = ({agency, agencyId, status=KStatus.PUBLISHED}) => {
	if (!agencyId) agencyId = agency.id;
	return DataStore.fetch(getListPath({type: C.TYPES.ImpactDebit, status, for:agencyId}), () => getImpactDebits2(agencyId, status));
};

const getImpactDebits2 = async (agencyId, status) => {
	let q;
	// What if it's a master brand, e.g. Nestle > Nespresso?
	// The only way to know is to look for children
	let pvListAgencies = Agency.getChildren(agencyId);
	let listAgencies = await pvListAgencies.promise; // ...wait for the results
	let ids = List.hits(listAgencies).map(adv => adv.id); // may be [], which is fine
	ids = ids.concat(agencyId); // include the top-level brand
	q = SearchQuery.setPropOr(null, "agency", ids);
	let pvListImpDs = getDataList({type:"ImpactDebit",status,q,save:true});
	let v = await pvListImpDs.promise;
	return v;
};
