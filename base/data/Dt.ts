import Enum from 'easy-enums';

class Dt {
	n : number;
	unit : string;

	constructor({n, unit}) {
		this.n = n;
		this.unit = unit;
	}
};

Dt.msecs = function(dt : Dt) : Number {
	switch(dt.unit) {
		case 'MILLISECOND': return dt.n;
		case 'SECOND': return dt.n / 1000;
		case 'MINUTE': return dt.n / (60*1000);
	}
	return null;
};

export const TUnit = new Enum("MILLISECOND SECOND MINUTE HOUR DAY WEEK MONTH YEAR");

export default Dt;
