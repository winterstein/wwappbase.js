/**
 * Collect adhoc date processing in one place to avoid repeatedly reinventing the wheel

Modern js is surprisingly good!

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat

*
 * TODO lets find a nice library that provides much of what we need.
 * 
 * day.js looks good
 * 
 * https://day.js.org/docs/en/timezone/set-default-timezone
 */

import { getUrlVars, toTitleCase } from './miscutils';

import dayjs from 'dayjs';
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { modifyPage } from '../plumbing/glrouter';
import DataStore from '../plumbing/DataStore';

dayjs.extend(utc);
dayjs.extend(timezone);
// window.dayjs = dayjs; // DEBUG

// console.warn("dayjs.tz", dayjs.tz);
// console.warn("dayjs.tz.guess", dayjs.tz.guess());

const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let _timezone = "UTC"; // default to UTC! not localTimeZone;
// dayjs.tz.guess();
// presumably guess() is doing 
export const getTimeZone = () => {
	return _timezone;
};
export const setTimeZone = (timezone: string) => {
	console.warn("setTimezone " + timezone + " from " + _timezone);
	// dayjs.tz.setDefault(timezone);
	_timezone = timezone;
	return timezone;
};

// initialise from url TODO handle changes
if (getUrlVars(null, null).tz) {
	setTimeZone(getUrlVars(null, null).tz);
}

export const getTimeZoneShortName = (timeZone: string | null) => {
	if (!timeZone) timeZone = getTimeZone();
	let ds = new Date().toLocaleDateString(
		navigator.language,
		{
			timeZone,
			timeZoneName: "short" // Hm... "short" gives UTC and BST, vs 'shortGeneric' which gives GMT and United Kingdom Time
		}
	);
	let spi = ds.indexOf(" ");
	return ds.substring(spi + 1);
}

/** 
 * @param {Date} date Daylight savings means the offset can change. Provide a date to give the answer for that date.
 * @returns A timezone offset in minutes from UTC So e.g. New York is about -300  */
// Thanks: https://stackoverflow.com/a/68593283/346629
export const getTimeZoneOffset = (timeZone: string, date = new Date()): number => {
	if ( ! timeZone) timeZone = getTimeZone();
	const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
	const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
	return (tzDate.getTime() - utcDate.getTime()) / 6e4;
}
// console.log("getTimeZoneOffset", getTimeZone(), getTimeZoneOffset(getTimeZone()));
// window.getTimeZoneOffset = getTimeZoneOffset;

/**
 * 0 = Sunday
 */
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortWeekdays = WEEKDAYS.map((weekday) => weekday.substr(0, 3));
export const WEEKDAYS_FROM_MONDAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const shortMonths = MONTHS.map((month) => month.substr(0, 3));

/**
 * Pad under 10 with "0". Especially useful with dates.
 * @param {Number} n
 * @returns {String} e.g. "03"
 */
export const oh = (n: number) => (n < 10 ? '0' + n : n);

export const dateUTCfromString = (s: string): Date => {
	const dateParts = s.split('T')[0].split('-');
	const year = parseInt(dateParts[0]);
	const month = parseInt(dateParts[1]) - 1; // Months are 0-based in JS, so subtract 1
	const day = parseInt(dateParts[2]);
	let hour = 0;
	let minute = 0;
	let second = 0;

	if (s.includes('T')) {
		const timeParts = s.split('T')[1].split(':');
		hour = parseInt(timeParts[0]);
		minute = parseInt(timeParts[1]);
		second = parseInt(timeParts[2].split('Z')[0]);
	}
	return new Date(Date.UTC(year, month, day, hour, minute, second));
};

/**
 * Make sure it's a Date not a String
 * @param s falsy returns null
 * TODO use the browser-default _timezone -- but paranoia check needed: Would this break any current use-cases
 * that might assume UTC??
 */
export const asDate = (s: Date | string | null): Date | null => {
	if (!s) return null;
	// Create the Date Object in UTC
	if (typeof s === 'string') {
		// FIXME This strips timezone! 
		return dateUTCfromString(s);
	}
	return s as Date;
};

/**
 * @return string in iso format (date only, no time-of-day part) e.g. 2020-10-18
 */
export const isoDate = (d: Date | string): string => asDate(d)!.toISOString().replace(/T.+/, '');

export const isoDateTZ = (d: Date | string): string => {
	let date = new Date(asDate(d)!);
	let offset = getTimeZoneOffset(getTimeZone(), date);
	// HACK: for eastern countries ahead of UTC, e.g. "1st June 00:00" in Paris = "31st May 23:00" UTC
	// so use a shifted time, then get the UTC date
	date.setMinutes(date.getMinutes() + offset);
	return isoDate(date);
};

/** 
 * Locale and timezone aware (but does not show the timezone)
 * @param {!Date} d
 * @returns {!string} e.g "13 Mar 2023"
 */
export const dateStr = (d: Date) => {
	let options = {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	} as Intl.DateTimeFormatOptions;
	const timeZone = getTimeZone();
	if (timeZone !== localTimeZone) {
		options.timeZone = timeZone;
		// options.timeZoneName = "shortGeneric"; for a date-only string, we probably don't show timezone
	}
	return d.toLocaleDateString(navigator.language, options);
};

/** date (without year) to string, formatted like "25 Apr"
 * This is timezone aware, but will not include the timezone.
 * Use-case: labelling charts
 */
export const printDateShort = (date: Date) => {
	return date.toLocaleDateString(
		navigator.language,
		{
			//   year: 'numeric',
			month: 'short',
			day: 'numeric',
			timeZone: getTimeZone(),
			//   timeZoneName: 'shortGeneric'
		}
	);
};

/**
 * Human-readable, timezone aware, minute level date+time string
 */
export const dateTimeString = (d: Date) => {
	let options = {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	} as Intl.DateTimeFormatOptions;
	const timeZone = getTimeZone();
	if (timeZone !== localTimeZone) {
		options.timeZone = timeZone;
		options.timeZoneName = "shortGeneric";
	}
	return d.toLocaleDateString(navigator.language, options);
};

// FROM dashutils

export type Period = { start?: Date; end?: Date; name?: string | null };

const equalPeriod = (periodA:Period, periodB:Period) => {
	if (periodA.name !== periodB.name) return false; // Least-surprise - consider "Q1" and "1 jan - 31 mar" different
	if (periodA.start?.getTime() !== periodB.start?.getTime()) return false;
	if (periodA.end?.getTime() !== periodB.end?.getTime()) return false;
	return true; // Unchanged!
};



/** Are these two Dates on the same day? */
export const sameDate = (d1: Date, d2: Date) => {
	if (!d1 || !d2) return false;
	return dateStr(d1) === dateStr(d2);
	//(d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()) <- no tz awareness
};

/** 00:00:00.000 on the same day as the given Date. TimeZone aware (not UTC unless timezone=utc!) */
export const dayStartTZ = (date = new Date()) => {
	return dayjs.tz(date, getTimeZone()).startOf('day').toDate();
};
/** 00:00:00.000 on the NEXT day as the given Date. TimeZone aware (not UTC unless timezone=utc!) */
export const dayEndTZ = (date = new Date()) => {
	let nextDay = new Date(date); // copy
	nextDay.setDate(nextDay.getDate()+1);
	return dayStartTZ(nextDay);
};

/**
 * E.g. midnight on 21st Jan, but in New York
 * @param isoDate e.g. 2023-01-21
 * @returns 
 */
export const newDateTZ = (isoDate:string): Date => {
	return dayjs.tz(isoDate, getTimeZone()).toDate();
};

/**
 * So (unlike Java) `new Date(year,month,day)` and new Date(isodate) is local-time
 * @param isoDate e.g. 2023-01-21
 * @returns midnight GMT for isoDate
 */
const newDateUTC = (isoDate:string) => {
	let m = isoDate.match(/(\d{4})-(\d{2})-(\d{2})/) as RegExpMatchArray;
	return new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))); // zero-indexed month!
};


/**
 * ??timezone handling??
 *
 * Returns a period object for the quarter enclosing the given date
 * @param {!Date} date 
 * @returns {start, end, name}
 */
export const getPeriodQuarter = (date : Date) => {
	const qIndex = Math.floor(date.getMonth() / 3);
	const month = qIndex*3 + 1;
	let year = date.getFullYear();
	let start = newDateTZ(year+"-"+oh(month)+"-01");
	const end = new Date(start);
	end.setMonth(end.getMonth() + 3);

	// Calcuate correct year
	let quarterYear = end.getFullYear()
	if (start.getFullYear() != end.getFullYear()) {
		if (end.getMonth() === 0) quarterYear = start.getFullYear();
	}
	return { start, end, name: `${quarterYear}-Q${qIndex + 1}` };
};

/**
 * ??timezone handling??
 * Returns a period object for the month enclosing the given date
 * @param {?Date} date
 * @returns {Period}
 */
export const getPeriodMonth = (date = new Date()): Period => {
	const start = newDateTZ(dayjs(date).format('YYYY-MM') + "01");
	const end = new Date(start);
	end.setMonth(end.getMonth() + 1);
	return { start, end }; //, name currently buggy for matching
};



export interface PeriodFromUrlParams extends Object {
	/** iso date */
	start?: string;
	/** iso date */
	end?: string;
	/** period name e.g. last-month */
	period?: string;
}

/**
 * Read period (name) or start/end
 * @param {Object} urlParams If unset use getUrlVars()
 */
export const getPeriodFromUrlParams = (urlParams: PeriodFromUrlParams | undefined = undefined): Period | null => {
	if (!urlParams) urlParams = getUrlVars(null, null);
	let { start, end, period } = urlParams!;
	// named?
	const periodObjFromName = periodFromName(period as string);
	// User has set a named period (year, quarter, month)
	if (periodObjFromName) {
		// fill in the start/end
		// NB: when adjusting start/end with PropControlPeriod, there is a moment where the name is wrong.
		if ( ! start) DataStore.setUrlValue("start", periodObjFromName.start!, false, {replaceState:true});
		if ( ! end) DataStore.setUrlValue("end", periodObjFromName.end!, false, {replaceState:true});
		return periodObjFromName;
	}

	// Custom period with start/end values
	if (start || end) {
		const periodFromStartEnd = {} as Period;
		if (start) {
			periodFromStartEnd.start = asDate(start)!;
		}
		if (end) {
			if (dateFormatRegex.test(end)) {
				end = end + `T23:59:59Z`; // Our endpoint does not support 59.999Z
			}
			periodFromStartEnd.end = asDate(end)!;
		}
		// const [, yyyy, mm, dd] = end.match(/(\d+)-(\d+)-(\d+)/) as any[];
		// period.end = new Date(yyyy, mm, dd);
		// period.end.setMonth(period.end.getMonth() - 1); // correct for Date taking zero-index months
		// // Intuitive form "Period ending 2022-03-31" --> machine form "Period ending 2022-04-01T00:00:00"
		// period.end.setDate(period.end.getDate() + 1);
		return periodFromStartEnd;
	}
	return null;
};

/** Convert a name to a period object
 * @returns {?Period}
 */
export const periodFromName = (periodName?: string): Period | null => {
	if (!periodName) {
		return null;
	}
	if (periodName === 'all') {
		return {
			start: new Date(0),
			end: new Date('3000-01-01'),
			name: 'all',
		};
	}
	let refDate = new Date();
	// yesterday
	if (periodName === "yesterday") {
		let end = dayStartTZ(refDate);
		let start = new Date(end);
		start.setDate(start.getDate() - 1);
		return {
			name:periodName, start, end
		};
	}
	if (periodName === "tomorrow") {
		let start = dayEndTZ(refDate);
		let end = new Date(start);
		end.setDate(end.getDate() + 1);
		return {
			name:periodName, start, end
		};
	}
	// eg "2022-Q2"
	const quarterMatches = periodName.match(quarterRegex) as unknown as number[];
	if (quarterMatches) {
		refDate.setFullYear(quarterMatches[1]);
		refDate.setMonth(3 * (quarterMatches[2] - 1));
		return getPeriodQuarter(refDate);
	}
	// this-month, last-month
	if (periodName==="this-month") {
		let p = getPeriodMonth(new Date());
		p.name = periodName;
		return p;
	}
	if (periodName==="last-month") {
		let d = new Date();
		d.setMonth(d.getMonth() - 1);
		let p = getPeriodMonth(d);
		p.name = periodName;
		return p;
	}
	if (periodName==="last-quarter") {
		let d = new Date();
		let pnow = getPeriodQuarter(d); // this quarter
		d = pnow.start;
		d.setMonth(d.getMonth() - 1);
		let p = getPeriodQuarter(d); // this quarter
		p.name = periodName;
		return p;
	}
	// // eg "2022-04"
	// const monthMatches = periodName.match(monthRegex) as unknown as number[];
	// if (monthMatches) {
	// 	refDate.setFullYear(monthMatches[1]);
	// 	refDate.setMonth(monthMatches[2]);
	// 	return getPeriodMonth(refDate);
	// }
	// const monthMatches2 = periodName.match(monthRegex2) as unknown as number[];
	// if (monthMatches2) {
	// 	refDate.setFullYear(monthMatches[1]);
	// 	refDate.setMonth(monthMatches[2]);
	// 	return getPeriodMonth(refDate);
	// }
	// // eg "2022" TODO
	// const yearMatches = periodName.match(yearRegex) as unknown as number[];
	// if (yearMatches) {
	// 	refDate.setFullYear(yearMatches[1]);
	// 	return getPeriodYear(refDate);
	// }
	throw new Error('Unrecognised period ' + periodName);
};

const quarterNames = [, '1st', '2nd', '3rd', '4th'];

/**
 * Take a period object and transform it to use as URL params.
 * This for handling name > peroid is filter.
 */
export const periodToParams = (period: Period) => {
	const newVals = {} as { [key: string]: string };
	if (period.name) {
		newVals.period = period.name as string;
	} else {
		// Custom period - remove period name from URL params and set start/end
		if (period.start) newVals.start = asDate(period.start)!.toISOString(); // full date! .substring(0,10);
		if (period.end) {
			// url params don't have to be pretty (push prettiness up to rendering code)
			newVals.end = asDate(period.end)!.toISOString(); // full date.substring(0,10);
			// // Machine form "Period ending 2022-04-01T00:00:00" --> intuitive form "Period ending 2022-03-31"
			// end = new Date(end);
			// end.setDate(end.getDate() - 1);
			// newVals.end = isoDate(end);
		}
	}
	return newVals;
};

/**
 * Turn period object into clear human-readable text
 * @param {Period} period Period object with either a name or at least one of start/end
 * @param {?Boolean} short True for condensed format
 * @returns in UTC TODO timezone support
 */
export const printPeriod = ({ start, end, name }: Period, short = false) => {
	if (name) {
		if (name === 'all') return 'All Time';

		// Is it a named period (quarter, month, year)?
		const quarterMatches = name.match(quarterRegex);
		if (quarterMatches) {
			const [, year, num] = quarterMatches as unknown as number[];
			if (short) return `Q${num} ${year}`; // eg "Q1 2022"
			return `${year} ${quarterNames[num]} quarter`; // eg "2022 1st Quarter"
		}

		const monthMatches = name.match(monthRegex) as unknown as number[];
		if (monthMatches) {
			const [, month, year] = monthMatches;
			return `${shortMonths[month]} ${year}`; // eg "Jan 2022"
		}

		const yearMatches = name.match(yearRegex);
		if (yearMatches) {
			const [, year] = yearMatches;
			if (short) return `${year}`; // eg "2022"
			return `Year ${year}`; // eg "Year 2022"
		}
		// e.g. yesterday
		return toTitleCase(name);
	}

	// Bump end date back by 1 second so eg 2022-03-01T00:00:00.000+0100 to 2022-04-01T00:00:00.000+0100
	// gets printed as "1 March 2022 to 31 March 2022"
	end = new Date(end!);
	end.setSeconds(end.getSeconds() - 1);

	// Prevent browsers in non UTC/ GMT Timezone shift the printing of the date
	// E.g. 2023-03-28T23:59:59Z became 2023-03-29T07:59:59Z in Asia
	let startUTC = `${start!.getUTCDate().toString()} ${shortMonths[start!.getUTCMonth()]} ${start!.getFullYear()}`;
	let endUTC = `${end.getUTCDate().toString()} ${shortMonths[end.getUTCMonth()]} ${end.getFullYear()}`;

	if (short) {
		startUTC = startUTC.substring(0, startUTC.length - 5);
		endUTC = endUTC.substring(0, endUTC.length - 5);
	}
	return `${startUTC || ``} to ${endUTC || `now`}`;
};

// export const periodKey = ({start, end, name}) : String => {
// 	if (name) return name;
// 	return `${start ? isoDate(start) : 'forever'}-to-${end ? isoDate(end) : 'now'}`
// };

const quarterRegex = /^(\d\d?\d?\d?)-Q(\d)$/;
const monthRegex = /^(\d\d?\d?\d?)-(\d\d?)$/;
const yearRegex = /^(\d\d?\d?\d?)$/;

const dateFormatRegex: RegExp = /^\d{4}-\d{2}-\d{2}$/;
