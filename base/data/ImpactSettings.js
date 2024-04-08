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
import Branding from './Branding';

/**
 * An extension of the branding class, contains impact page specific settings
 */
class ImpactSettings extends Branding {
	/**
	 * @type {Boolean} show ads that haven't served on this page
	 */
	showNonServedAds;
}

DataClass.register(ImpactSettings, "ImpactSettings"); 

/**
 * Combine item.impactSettings with item.branding
 * @param {DataClass} item 
 * @returns {?ImpactSettings} a fresh unattached object
 */
ImpactSettings.get = item => item && Object.assign({}, item.branding, item.impactSettings);

export default ImpactSettings;
