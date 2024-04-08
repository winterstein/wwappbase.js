
import _ from 'lodash';
import DataClass, {getType} from './DataClass';
import Enum from 'easy-enums';
import Impact from './Impact';
import { is } from '../utils/miscutils';

/** See ImpactCredit.java
*/
class ImpactCredit extends DataClass {
	/** @type {Impact} */
	impact;

	/** @type{?String} */
	agencyId;

	/** @type{?String} */
	vertiser;

	constructor(base) {
		super();
		DataClass._init(this, base);
	}
}
DataClass.register(ImpactCredit, "ImpactCredit");
const This = ImpactCredit;
export default ImpactCredit;

ImpactCredit.certified = item => ImpactCredit.assIsa(item) && (item.certificateFile || item.certificateUrl || item.certificates);
