/**
	MoneyItem - a named Money thing
*/
import DataClass from './DataClass';
import Money from './Money';

/** impact utils */
class MoneyItem extends DataClass {

};
DataClass.register(MoneyItem, "MoneyItem");
export default MoneyItem;

MoneyItem.str = mi => {
	if (mi.text && mi.money) return Money.str(mi.money)+" "+mi.text;
	if (mi.text) return mi.text;
	if (mi.money) return Money.str(mi.money);
	return ""+mi;
};