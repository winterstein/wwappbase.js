import React, { useEffect, useState } from 'react';
import { Button, Col, Input, InputGroup, Row } from 'reactstrap';
import DataStore from '../../plumbing/DataStore';
import { oh, isoDate, MONTHS, dayStartTZ, periodFromName } from '../../utils/date-utils';
import Misc from '../Misc';

import PropControl, { fakeEvent, registerControl } from '../PropControl';
import PropControlTimezone from './PropControlTimezone';
import { stopEvent, toTitleCase } from '../../utils/miscutils';

/**
 * Really two PropControls - with some handy buttons for setting both
 */
function PropControlPeriod2({className, style, path, propStart = "start", propEnd = "end", propPeriodName="period", buttons=["yesterday", "this-month"], saveFn }) {
	const clearPeriodName = () => {
		DataStore.setValue(path.concat(propPeriodName), null);
	};

	const adjustStartEnd = (props) => {
		const start = isoDate(DataStore.getValue(path.concat(propStart)));
		const end = isoDate(DataStore.getValue(path.concat(propEnd)));
		DataStore.setValue(path.concat(propStart), dayStartTZ(start).toISOString());
		DataStore.setValue(path.concat(propEnd), dayStartTZ(end).toISOString());
	}
	let dobj = DataStore.getValue(path);
	return <div className={className} style={style}>
		{buttons && <div className="flex-row">
			{buttons.map(b => <PeriodButton key={b} name={b} path={path} propStart={propStart} propEnd={propEnd} propPeriodName={propPeriodName} />)}
		</div>}
		<Row className='mt-2'>
			<Col sm={6} >
				<PropControl prop={propStart} path={path} label type="date" time="start" saveFn={clearPeriodName} max={dobj?.end} />
			</Col><Col sm={6} className='pl-1'>
				<PropControl prop={propEnd} path={path} label type="date" time="end" saveFn={clearPeriodName} min={dobj?.start} />
			</Col>
		</Row>
		<Row>
			<Col sm={12}>
				<PropControlTimezone className="mt-2" size="sm" label="Timezone" prop="tz" saveFn={adjustStartEnd} />
			</Col>
		</Row>
	</div>;
}


const PeriodButton = ({name, label, path, propStart, propEnd, propPeriodName}) => {
	const now = new Date();
	let period = periodFromName(name);
	const setPeriod = _evt => {
		DataStore.setValue(path.concat(propPeriodName), period.name);
		DataStore.setValue(path.concat(propStart), period.start?.toISOString());
		DataStore.setValue(path.concat(propEnd), period.end?.toISOString());
	};
	let startv = DataStore.getValue(path.concat(propStart));
	let endv = DataStore.getValue(path.concat(propEnd));
	let isActive = false; // TODO

	return <Button active={isActive} color="outline-secondary" size="sm" className="mr-2" onClick={setPeriod}>
		{label || toTitleCase(name)}
	</Button>;
}

// registerControl({ type: 'period', $Widget: PropControlPeriod2 });

function PropControlPeriodMonthYear({ path, propStart = "start", propEnd = "end" }) {
	let startv = DataStore.getValue(path.concat(propStart));
	let endv = DataStore.getValue(path.concat(propEnd));
	let wpath = ["widget"].concat(path);
	const now = new Date();
	// change form convenience inputs into ImpactDebit fields
	let month = DataStore.getValue(wpath.concat("month"));
	let year = DataStore.getValue(wpath.concat("year"));
	if (month && year) {
		startv = year + "-" + oh(MONTHS.indexOf(month) + 1) + "-01";
		let startNextMonth = year + "-" + oh(MONTHS.indexOf(month) + 2) + "-01";
		if (startNextMonth.includes("-13-")) {
			startNextMonth = ((year * 1) + 1) + "-01-01"; // NB force year to be a number so we can +1
		}
		let dend = new Date(new Date(startNextMonth).getTime() - 1);
		endv = isoDate(dend);
		DataStore.setValue(path.concat(propStart), startv);
		DataStore.setValue(path.concat(propEnd), endv);
	}

	return <>
		<Row>
			<Col><PropControl type="select" prop="month" label options={MONTHS} path={wpath} />
			</Col><Col>
				<PropControl type="select" prop="year" label options={[now.getFullYear() - 1, now.getFullYear()]} path={wpath} dflt={now.getFullYear()} />
			</Col>
		</Row>
		<p><small>start: <Misc.DateTag date={startv} /> end: <Misc.DateTag date={endv} /></small></p>
	</>;
}

/**
 * This is NOT actually a PropControl -- it wraps TWO PropControls (start, end)
 * @param {Object} p
 * @param {?String[]} p.path 
 * @param {?String} p.propStart default:start
 * @param {?String} p.propEnd default:end
 * @param {?String} p.options HACK if "month-year" then use a simplified month/year picker
 * @param {?String} buttons =["yesterday", "this-month"]
 * @returns 
 */
function PropControlPeriod(p) {
	// HACK a bit of the machinery from PropControl
	if (!p?.path) {
		p = Object.assign({ path: ['location', 'params'] }, p);
	}
	// HACK how shall we switch format?
	if (p.options && ("" + p.options).includes("month")) {
		return <PropControlPeriodMonthYear {...p} />;
	}
	return <PropControlPeriod2 type="period" {...p} />;
}
export default PropControlPeriod;
