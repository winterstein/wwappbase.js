
import _ from 'lodash';
import { assert, assMatch } from '../utils/assert';
import DataClass, {nonce} from './DataClass';
import Money from './Money';
import C from '../CBase';
import Login from '../youagain';
import DataStore from '../plumbing/DataStore';
import ServerIO from '../plumbing/ServerIOBase';

class Transfer extends DataClass {
	/** {Money} */
	amount;
	/** {String} */
	to;
	constructor(base) {
		super(base);
		Object.assign(this, base);
	}
}
DataClass.register(Transfer, 'Transfer');
const This = Transfer;
export default Transfer;


/** Add up the prices of all the items in the basket 
 * @returns {Money} never null
*/
Transfer.getTotal = (list, to) => {
	assMatch(to, String);
	// Using this clumsy forEach instead of a reduce because this makes it clearer
	// that the total's Money object (thus currency) is based on the first item
	let total = new Money();
	list.forEach((item) => {
		This.assIsa(item);
		let amount = item.amount;
		Money.assIsa(amount);
		if (item.to !== to) { // TODO user with multiple IDs, eg email+Twitter
			// Login.iam(to)
			amount = Money.mul(amount, -1);
		}
		total = Money.add(total, amount);
	});
	return total || new Money();
};

/**
 * TODO do this server-side
 */
Transfer.getCredit = (uxid) => {
	if ( ! uxid) uxid = Login.getId();
	if ( ! uxid) return null;
	const pvCreditToMe = DataStore.fetch(['list', 'Transfer', 'toFrom:'+Login.getId()], () => {
		// don't show an error if the credit load fails?? 'cos no-ones using credit for now
		return ServerIO.load('/credit/_list', {data: {toFrom: Login.getId()}, swallow:true });
	});
	if (pvCreditToMe.value) {
		// sum them
		let cred = Transfer.getTotal(pvCreditToMe.value.hits, uxid);
		return cred;
	}
	return null;
};
