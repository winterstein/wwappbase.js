import React from 'react';
import _ from 'lodash';

// import chartjs from 'chart.js';
// import RC2, {Line} from 'react-chartjs2';
import { Chart, Line } from 'react-chartjs-2';
import { assert } from '../utils/assert';

/**
	@param dataFromLabel e.g. (label)adview -> time -> number
	@param off {?Boolean} If true, datasets will start "hidden" (but you can switch them on in the legend)
 */
class ChartWidget extends React.Component {
	constructor(props) {
		super(props);
	}

	componentWillMount() {
		this.setState({
		});
	}

	componentDidCatch(error, info) {
		this.setState({error, info});
		console.error(error, info);
		if (window.onerror) window.onerror("ChartWidget caught error", null, null, null, error);
	}

	shouldComponentUpdate(nextProps, nextState) {
		//A bit hacky, but it looks like the page is always refreshed when data is changed.
		//If this remains the case, it's a lot easier to do this and avoid -- potentially expensive -- equality checks
		return false;
	}

	render() {
		// TODO all-off initially
		// https://github.com/chartjs/Chart.js/issues/3150
		// chart.getDatasetMeta(1).hidden=true;
		// chart.update();

		let {title, dataFromLabel, off} = this.props;
		console.log("ChartWidget", {title, dataFromLabel});
		assert(dataFromLabel, "ChartWidget.jsx - no dataFromLabel");
		// title = title || "Junk Data";
		let label = "Stuff";
		let timeFormat = 'MM/DD/YYYY HH:mm';
		// function newDateString(days) {
		// 	return moment().add(days, 'd').format(timeFormat);
		// }
		let labels = [];
		let datasets = [];
		let keys = Object.keys(dataFromLabel);
		let dataPoints = 0;
		for(let i=0; i<keys.length; i++) {
			let key = keys[i];
			// if (key !== 'mem_used') continue; Debug hack
			let data = dataFromLabel[key];
			labels.concat(Object.keys(data));
			// if ( ! _.isArray(data)) {
				// console.warn("skip not-an-array", key, data);
				// continue;
			// }
			let xydata = Object.keys(data).map(k => { return {x:k, y:data[k]}; });
			xydata = xydata.filter(xy => xy.y);
			dataPoints += xydata.length;
			let dset = makeDataSet(i, keys[i], xydata);
			// off by default?
			if (off) dset.hidden = true;
			// console.warn(dset);
			datasets.push(dset);
		}
		//window.z = datasets;
		let chartData = {
			labels,
			datasets
		}; //./data
		let chartOptions = {
			// animation: false,
			//title: title,
			scales: {
				yAxes: [{
					type: 'linear',
					ticks: {
						beginAtZero:true
					}
				}],
				xAxes: [{
					type: 'time',
					time: {
						displayFormats: {
							quarter: 'MMM YYYY',
							hour: 'MMM D hA'
						}
					}
				}]
			}
		}; // ./options;
		console.warn("RC2 Draw chart", chartOptions, chartData);
		return (<div><h3>{title}</h3>
					{/* <RC2 data={chartData} options={chartOptions} type="line" /> */}
					<Chart data={chartData} options={chartOptions} type="line" />
					<div>
						{true ? <small>Labels: {JSON.stringify(keys)}, Total data points: {dataPoints}</small> : null}
					</div>
					{ dataPoints ? <a href="#" onClick={(e) => { e.preventDefault(); this.exportCSV(chartData); }}>&#128229; Download .csv</a> : null }
					<br />
					{ dataPoints ? <a href="#" onClick={(e) => { e.preventDefault(); this.exportClickDataCSV(chartData); }}>&#128229; Download Click Data .csv</a> : null }	
				</div>);
	} // ./render

	downloadCSV(rows) {
		let csvData = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
		window.open(encodeURI(csvData));
	}

	exportCSV(chartData) {
		let rows = [
			["event", "date", "count"]
		];

		chartData.datasets.map(dataset => {
			dataset.data.map(datapoint => {
				rows.push([dataset.label, datapoint.x, datapoint.y]);
			});
		});

		this.downloadCSV(rows);
	} // ./exportCSV

	exportClickDataCSV(chartData) {
		let rows = [
			["date", "clicks"]
		];

		chartData.datasets.map(dataset => {
			if (dataset.label == "click") {
				dataset.data.map(datapoint => {
					rows.push([datapoint.x, datapoint.y]);
				});
			}
		});

		this.downloadCSV(rows);
	} // ./exportCLickDataCSV
} 

/**
 * @param data Array of {x (which can be a Time string), y}
 * @returns {label, data, etc}
 */
const makeDataSet = (i, label, xydata) => {
	// console.log('makeDataSet', label, xydata);
	// HACK pick a colour
	let colors = ["rgba(75,192,192,1)", "rgba(192,75,192,1)", "rgba(192,192,75,1)", "rgba(75,75,192,1)", "rgba(75,192,75,1)", "rgba(192,75,75,1)"];
	let color = colors[i % colors.length];
	return {
		label: label,
		fill: false,

		lineTension: 0.05, // higher, and spikes can turn into loopy calligraphy
		// cubicInterpolationMode: 'monotone',
		backgroundColor: color, // TODO 0.4 alpha
		borderColor: color,
		// borderCapStyle: 'butt',
		// borderDash: [],
		// borderDashOffset: 0.0,
		// borderJoinStyle: 'miter',
		pointBorderColor: color,
		pointBackgroundColor: "#fff",
		// pointBorderWidth: 3,
		// pointHoverRadius: 7,
		pointHoverBackgroundColor: color,
		pointHoverBorderColor: "rgba(220,220,220,1)",
		// pointHoverBorderWidth: 2,
		// pointRadius: 1,
		// pointHitRadius: 10,
		// or {x: time-string, y: value}
		data: xydata,
		// spanGaps: false,
	};
};


export default ChartWidget;
