import React from 'react';

import { Chart as ChartJS, CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, ArcElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Pie, Bar, Scatter } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Annotation from 'chartjs-plugin-annotation';
import Enum from 'easy-enums';

import { dateStr, oh } from '../utils/date-utils';
import { is, space, asNum } from '../utils/miscutils';

/** TODO We should be able to do this dynamically/selectively when components are rendered */
ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, ArcElement, BarElement, Title, Tooltip, Legend, Annotation);

/**
 * axes scaling
 */
export const KScale = new Enum("linear logarithmic");

/**
 * ?? How do we set the size of the chart??
 *
 * @param {Object} p
 * @param {?number} p.width Set to null to inherit See https://github.com/reactchartjs/react-chartjs-2/issues/362
 * @param {?number} p.height Set to null to inherit
 * @param {Object} p.data { labels:string[], datasets:[{label, data:number[]}] } The labels and data arrays get paired up.
 * See timeSeriesChartFromKeyValue()
 * @param {?Object} p.datalabels See https://www.npmjs.com/package/chartjs-plugin-datalabels
 * @param {?number} p.maxy max y scale (usually this is auto-fitted from the data)
 * @param {Object} p.options {scales: {x, y}, plugins}
 * @param {String} p.type line|pie|bar|scatter
 * @returns
 */
function NewChartWidget({ type = 'line', data, datalabels, className, style, width, height, miny, maxy, legend, options={}, ...props }) {	
	options.maintainAspectRatio = options.maintainAspectRatio || false; // why??
	if (datalabels) {
		addPluginToProps(props, ChartDataLabels);
	}
	// set y scale?
	if (is(miny) || is(maxy)) {
		if (!options.scales) options.scales = {};
		if (!options.scales.y) options.scales.y = {};
		if (is(maxy)) options.scales.y.max = maxy;
		if (is(miny)) options.scales.y.min = miny;
	}
	// legend?
	addPluginToProps(props, Legend, { display: !!legend });
	let Chart = { line: Line, pie: Pie, bar: Bar, scatter: Scatter }[type];

	return (
		<div className={space('NewChartWidget position-relative', className)} style={style}>
			<Chart data={data} width={width} height={height} options={options} {...props} />
		</div>
	);
}

/**
 *
 * @param {!Object} props The top level `props`
 * @param plugin ChartJS Plugin e.g. Legend
 * @param {?Object} options
 */
function addPluginToProps(props, plugin, options) {
	if (props.plugins) {
		if (!props.plugins.includes(plugin)) {
			props.plugins.push(plugin);
		}
	} else {
		props.plugins = [plugin];
	}
	if (options) {
		if (!options.plugins) options.plugins = {};
		let po = options.plugins[plugin.id] || {};
		options.plugins[plugin.id] = Object.assign(po, options);
	}
}


/**
 * Convert key:value data into data+options for the chart.
 * 
 * Note: You can turn DataLog data into key:value form using pivot:
 * let kvData = pivot(data, `by_time.buckets.$bi.{key, count}`, '$key.$count');

 * Copy pasta from Green Dashboard TimeSeriesCard
 * @param {!Object} kvData data in {key: value} form where the keys are numerical epoch time milliseconds
 * @returns {data, options} for use with NewChartWidget
 */
export const timeSeriesChartFromKeyValue = (kvData, options={label:"By Time",color:'#52727a'}) => {
	// labelling fn
	const min = Math.min(...Object.keys(kvData));
	const max = Math.max(...Object.keys(kvData));
	const minDate = new Date(asNum(min));
	const maxDate = new Date(asNum(max));
	const dt = (max-min) / Object.keys(kvData).length;
	const showTime = dt < 12*60*60*1000; // under 12 hours?
	const showYear = minDate.getYear() !== maxDate.getYear();
	const labelFn = x => {
		const d = new Date(asNum(x));
		let ds = dateStr(d);
		// Omit year in labels if the period doesn't span a year boundary
		if ( ! showYear) {
			ds = ds.substring(0, ds.length - 5);
		}
		if (showTime) {
			ds += " "+oh(d.getUTCHours())+":"+oh(d.getUTCMinutes());	
		}		
		return ds;
	};

	const labels = [];
	const data = [];
	// Sum total emissions for each date across all other factors, sort, and unzip to labels/data arrays
	Object.entries(kvData).forEach(([time, val]) => {
		labels.push(labelFn(time));
		data.push(val);
	});

	let newChartProps = {
		data: {
			labels,
			datasets: [{
				label:options.label,
				data,
				cubicInterpolationMode: 'monotone',
				borderColor: options.color
			}],
		},
		options: {
			scales: {
				x: {
					ticks: { maxRotation: 0, minRotation: 0 } // Don't angle date labels - skip some if space is tight
				},
				y: {
					ticks: { precision: 2 },
				},
			},
			plugins: {
				legend: { display: false }, // ??do we want this as a default??
				autocolors: false,
			},
		}
	};
	return newChartProps;
};


// /**
//  * How to make this useful?? Maybe just link to the chartjs documentation instead?? And define a ts type??
//  * @param {*} newChartProps {data, options}
//  * @param {*} y 
//  * @returns 
//  */
// export const addLine = (newChartProps, y) => {
// 	let merged = _.merge(newChartProps, {options: {
// 		annotation: {
// 			annotations: {
// 				line1: {
// 					type: 'line',
// 					yMin: y,
// 					yMax: y,
// 					borderDash: [5, 5],
// 					borderColor: '#aaa',
// 					borderWidth: 2,
// 					label: { enabled: true, content: 'Avg', position: 'end' },
// 				}
// 			}
// 		}
// 	}});
// 	return merged;
// };



export default NewChartWidget;
