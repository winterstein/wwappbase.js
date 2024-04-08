// TODO DataLog results handling

// See also log.js for data input

import pivot from 'data-pivot';
import md5 from 'md5';
import { assert } from '../utils/assert';
import { encURI } from '../utils/miscutils';
import DataStore from './DataStore';
import ServerIO from './ServerIOBase';
import { getTimeZone } from '../utils/date-utils';

/**
 * @param {Object} p
 * @param {?String} p.btz Bucket timezone, works with interval. Defaults to getTimeZone() 
 * @param {String} p.q
 * @param {!String} p.dataspace
 * @param {?String[]} p.breakdowns - e.g. ['campaign'] will result in by_campaign results.
 * NB: the server parameter is currently `breakdown` (no -s).
 * Eventually we want to standardise on `breakdowns` as it's more intuitive for an array type,
 * but making the change server-side is expected to be involved.
 * @param {?String|Date} p.start Date/time of oldest results (natural language eg '1 week ago' is OK). Default: 1 month ago
 * @param {?String|Date} p.end Date/time of oldest results
 * @param {?boolean} p.incs include start
 * @param {?boolean} p.ince include end
 * @param {?String} p.name Just for debugging - makes it easy to spot in the network tab
 * @param {?String} p.op sum or coming-soon avg|stats
 * @param {?Number} p.prob [0,1] Probability for random sampling. -1 for auto-calc
 * @param {?String} p.interval day / hour / 15 minutes etc time-bucket size
 * @param {?number} p.size for examples (10 by default)
 * @returns PromiseValue "ElasticSearch format" (buckets with a key)
 */
const getDataLogData = ({q,breakdowns,start="1 month ago",end="now",prob,name,interval,btz,incs,ince,op="sum",dataspace=ServerIO.DATALOG_DATASPACE,size}) => {
	assert(dataspace);
	let phack = prob? Math.round(10*prob) : prob; // (old code, Feb 23) handle DataServlet prob=[0,10] code
	if (phack === -10) phack=88; // HACK (old code, Feb 23) special value for "pick a prob"
	// NB: the server doesnt want an -s on breakdown
	if ( ! btz) btz = getTimeZone();
	const glreq = {q, start, end, prob:phack, prb:prob, breakdown:breakdowns, interval, btz, name, dataspace, incs, ince, op, size};
	let dspec = md5(JSON.stringify(glreq));
	const dlpath = ['misc', 'DataLog', dataspace, dspec];

	return DataStore.fetch(dlpath, () => {
		let endpoint = ServerIO.DATALOG_ENDPOINT;
		// This stats data is _usually_ non essential, so swallow errors.
		const params = {data: glreq, swallow:true, method:"POST"};
		const url = endpoint + (name ? `?name=${encURI(name)}` : '');
		let ajax = ServerIO.load(url, params);
		return ajax.then(res => {
			// unpack sampling
			if (res.cargo?.sampling) {
				Object.assign(res.cargo, res.cargo.sampling);
				delete res.cargo.sampling;
			}
			return res;
		});
	});
};

/**
 * Convert from "ElasticSearch format" (buckets with a key) into `{key: value}` format
 * @param {Object} data Output from getDataLogData()
 * @param {!String[]} breakdowns e.g. ["event","day"]
 * @returns e.g. {myevent: {monday:1, tuesday:2, total:3}}
 */
const pivotDataLogData = (data, breakdowns) => {
	if ( ! data) {
		console.error("pivotDataLogData - undefined data?!",breakdowns);
		return null;
	}
	if (data.sampling) {
		data = data.sampling; // unwrap sampling
	}
	// HACK 1/2 only
	assert(breakdowns.length===1 || breakdowns.length===2, breakdowns);
	const b0 = breakdowns[0];
	if (breakdowns.length===1) {
		let pivoted = pivot(data, `by_${b0}.buckets.$bi.{key, count}`, '$key.$count');
		return pivoted;
	}
	// unpick double-breakdown
	const b1 = breakdowns[1];
	let din = `by_${b0}_${b1}.buckets.$bi.{key, by_${b1}.buckets.$bi2.$bucket}`;
	let data2 = pivot(data, din, '$key.$bi2.$bucket');
	let data3 = pivot(data2, '$bkey0.$bi2.{key, count}', '$bkey0.$key.$count');
	// add in single-breakdown totals -- if present (i.e. if the user requested it)
	if ( ! data["by_"+b0]) {
		return data3; // just kkv, no totals
	}
	let evttotaldata = pivot(data, `by_${b0}.buckets.$bi.{key, count}`, '$key.total.$count');
	let data4 = _.merge(data3, evttotaldata);
	return data4;
};



/**
 * Convert from "ElasticSearch format" (buckets with a key) into rows format [{key1, key2, count}]
 * @param {Object} data Output from getDataLogData()
 * @param {!String} breakdown e.g. 'brand/campaign{"co2":"sum"}'
 * @returns {Object[]} e.g. [{brand, campaign, count, co2}, ...]
 */
 const pivotDataLogToRows = (data, breakdown) => {
	let ei = breakdown.indexOf("{");
	let b = ei===-1? breakdown : breakdown.substring(0, ei);
	let bits = b.split("/");
	if (data.sampling) { // unwrap sampling if present
		data = data.sampling;
	}
	// NB: multiple keys named "key" means pivot() wont work
	let rows = pivotDataLogToRows2(data, bits);
	// console.log("pivotDataLogToRows", data, breakdown, rows);
	return rows;
};

const pivotDataLogToRows2 = (data, bits) => {
	if ( ! bits.length) {
		return [{...data}]; // copy so we can safely change "key" to eg "campaign"
	}
	let bit = bits[0];
	let byKey = "by_"+bits.join("_");
	let byBit = data[byKey];
	assert(byBit, "No data for breakdown "+byKey, Object.keys(data));
	let buckets = byBit.buckets;
	let rows = [];
	const bits2 = bits.slice(1);
	for(let bi=0; bi<buckets.length; bi++) {
		let bucket = byBit.buckets[bi];
		let ki = bucket.key;
		let rowsi = pivotDataLogToRows2(bucket, bits2);		
		rowsi.forEach(row => {
			delete row.key;
			row[bit] = ki;
			rows.push(row);
		});
	}
	return rows;
};


export {
	getDataLogData, pivotDataLogData, pivotDataLogToRows
};

