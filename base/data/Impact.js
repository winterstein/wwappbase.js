import _ from 'lodash';
import DataClass, { getType } from '../../base/data/DataClass';
import Money from './Money';
import Enum from 'easy-enums';
import { is } from '../utils/miscutils';
import printer from '../utils/printer';
import I18N from '../../base/i18n';

/** Impact type. See Impact.java -- NB: copy-pasta from SoGive's Output.js.
 */
class Impact extends DataClass {
	/** @type {Money} */
	amount;
	/** @type {Double} */
	amountGBP;
	/** @type {String} */
	charity;
	/** @type {?string | undefined} e.g. "impressions" */
	input;
	/** @type {Number} Number of units output, e.g. the number of malaria nets */
	n;
	/** @type {String} The type of impact eg `carbon offset` */
	name;
	notes;
	progress;
	rate;
	ref;
	dynamic;
	campaign;
	start;
	end;
	/** @type {?Impact} the dynamic original for a snapshot of a dynamic Impact */
	src;
	constructor(base) {
		super();
		DataClass._init(this, base);
	}
}
DataClass.register(Impact, 'Impact');
const This = Impact;
export default Impact;

/**
 * See KImpactNames.java
 */
Impact.KImpactNames = ['carbon offset', 'tree(s)', 'coral', 'meal(s)'];

/**
 * Is this a dynamic impact, which should be calculated from e.g. impressions*rate?
 * @param {?Impact} impact
 * @returns {boolean}
 */
Impact.isDynamic = (impact) => {
	if (!impact) return false;
	if (!impact.name) {
		console.warn('Impact without a name (ie thing-it-does like trees)', impact);
		return false;
	}
	if (is(impact.dynamic)) {
		return impact.dynamic;
	}
	if (impact.rate && !impact.n) {
		console.log('Impact with old data - dynamic rate but not explicitly set as dynamic', impact);
		return true;
	}
	return false;
};

/**
 * HACK says yes to "carbon" "carbon offset(s)" "carbon offset (kg)" etc.
 * @param {?Impact} impact
 * @returns {boolean}
 */
Impact.isCarbonOffset = (impact) => impact?.name && impact.name.substring(0, 6) === 'carbon';

/**
 * @param {Impact} impact
 */
Impact.amount = (impact) => impact?.amount;

/**
 * 
 * @param {?Impact} impact 
 * @returns {?string} e.g. "5 trees"
 */
Impact.str = impact => {
	if ( ! impact || ! impact.name) return null;
	let sImpactCount = printer.prettyNumber(impact.n);
	const s = I18N.tr(sImpactCount+" "+impact.name);
};

export const KImpactStage = new Enum(
	'PLANNING CAMPAIGN_OPEN SUPPLIER CAMPAIGN_DONE BRAND_PAID CHARITY_INVOICE_REQUESTED CHARITY_INVOICE_RECEIVED CHARITY_PAID PROJECT_DONE'
);
