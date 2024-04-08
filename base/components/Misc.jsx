import React, { useState, Fragment, useEffect } from 'react';

import { Alert, Card, CardBody, Nav, Button, NavItem, NavLink } from 'reactstrap';
import PromiseValue from '../promise-value';
import md5 from 'md5';
import _ from 'lodash';

import { assert, assMatch } from '../utils/assert';
import {copyTextToClipboard, getLogo, space, stopEvent, str } from '../utils/miscutils';

import JSend from '../data/JSend';

import DataStore from '../plumbing/DataStore';
import ServerIO from '../plumbing/ServerIOBase';
import printer from '../utils/printer';
import {LoginLink} from './LoginWidget';
import C from '../CBase';
import Money from '../data/Money';

import { getId} from '../data/DataClass';
import ErrAlert from './ErrAlert';
import XId from '../data/XId';
import Roles from '../Roles';
import Icon from './Icon';
import { oh, isoDate, MONTHS, asDate, shortMonths } from '../utils/date-utils';
import SubmitButton from './SubmitButton';

const Misc = {};


/**
 * Normalise unicode characters which have ascii equivalents (e.g. curly quotes), to avoid many annoying issues.
 */
Misc.normalise = s => {
	if ( ! s) return s;
	s = s.replace(/[''''ʼ]/g, "'"); // but not ` which is a markdown special character
	s = s.replace(/[\"“”„‟❛❜❝❞«»]/g, '"');
	s = s.replace(/[‐‑‒–—―-]/g, '-');
	s = s.replace(/[\u00A0\u2007\u202F\u200B]/g, ' ');
	return s;
};

// Pulled out so we can override it with a site-specific graphic
Misc.spinnerSvg = (
	<svg xmlns="https://www.w3.org/2000/svg" viewBox="0 0 100 100">
		<g style={{stroke: 'none'}}>
				<path style={{fill: '#f6ecd1'}} d="M 50 0 a 50 50 0 0 0 -50 50 L 10 50 a 40 40 0 0 1 40 -40 Z" />
				<path style={{fill: '#507e88'}} d="M 0 50 a 50 50 0 0 0 50 50 L 50 90 a 40 40 0 0 1 -40 -40 Z" />
				<path style={{fill: '#656565'}} d="M 50 100 a 50 50 0 0 0 50 -50 L 90 50 a 40 40 0 0 1 -40 40 Z" />
				<path style={{fill: '#c73413'}} d="M 100 50 a 50 50 0 0 0 -50 -50 L 50 10 a 40 40 0 0 1 40 40 Z" />
		</g>
	</svg>
);


/**
E.g. "Loading your settings...""
See https://www.w3schools.com/howto/howto_css_loader.asp
http://tobiasahlin.com/spinkit/

@param {Object} props
@param {PromiseValue} [props.pv] If set, this will be checked for errors. This is for the common use-case, where Loading is used during an ajax call (which could fail).
@param {String} [props.text] Static text message
@param {Boolean} [props.inline] Lay out elements horizontally
*/
Misc.Loading = ({text = 'Loading...', pv, inline}) => {
	// Handle ajax error / completion
	if (pv) {
		if (pv.error) return <ErrAlert error={pv.error} />;
		if (pv.value) return null;
	}

	return (
		<div className={space('loader-box', inline && 'inline')} style={{textAlign: 'center'}}>
			<div className="spinner-box">
				{Misc.spinnerSvg}
			</div>
			<div className="loader-text">{text}</div>
		</div>
	);
};


/** Used by Misc.ListEditor below */
const DefaultItemEditor = ({item, path}) => <div>{JSON.stringify(item)}</div>;

/**
 * NB: only used on AdvertPage -- TODO deprecate
 * 
 * list with add, TODO remove, reorder. A simpler in-memory cousin of ListLoad
 * @param path {String[]} path to the list (which must be an array)
 * @param ItemEditor {Function} {item, path: to item i, i, ...stuff} -> jsx
 * @param blankFactory {?Function} path -> blank
 */
Misc.ListEditor = ({path, ItemEditor = DefaultItemEditor, blankFactory, noneMessage, createText = 'Create', className, ...stuff}) => {
	let list = DataStore.getValue(path) || [];
	assert(_.isArray(list), "ListEditor " + path, list);

	const addBlank = () => {
		const blank = blankFactory ? blankFactory(path) : {};
		list = list.concat(blank);
		DataStore.setValue(path, list);
	};

	const remove = index => {
		if (!confirm("Remove - Are you sure?")) return; // Confirm before delete

		list.splice(index, 1); // modify list to remove the item
		DataStore.setValue(path, list, true); // update
	};

	const itemElements = list.map((item, index) => (
		<Card className="item-editor mb-3" key={'item' + index}>
			<CardBody>
				<Button color="danger" size="xs" onClick={e => remove(index)} className="pull-right mb-2">&#x1f5d1;</Button>
				{item.name ? <h4>{index}. {item.name}</h4> : null}
				<ItemEditor i={index} item={item} path={path.concat(index)} list={list} {...stuff} />
			</CardBody>
		</Card>
	));

	return (
		<div className={space('list-editor mb-4', className)}>
			{itemElements}
			{list.length ? null : <p>{noneMessage || 'None'}</p>}
			<div>
				<Button onClick={addBlank}>&#8853; {createText}</Button>
			</div>
		</div>
	);
};


/**
 * @param noContainer {Boolean} Dont wrap in a .container, this is going in a context which permits .rows already
 * TODO?? noPadding: {Boolean} switch off Bootstrap's row padding.
 */
Misc.Col2 = ({children, noContainer}) => {
	const row = (
		<div className="row">
			<div className="col-md-6 col-sm-6">{children[0]}</div><div className="col-md-6 col-sm-6">{children[1]}</div>
		</div>
	);
	return noContainer ? row : <div className="container-fluid">{row}</div>;
};


/**
 * Money span, falsy displays as 0
 *
 * @param amount {?Money|Number}
 */
Misc.Money = ({amount, minimumFractionDigits, maximumFractionDigits = 2, maximumSignificantDigits}) => {
	if (_.isString(amount)) {
		console.warn("Misc.Money - Please use numbers NOT strings: ", amount);
		// sanitise string and parse to number
		amount = parseFloat(amount.replace(/[£$,]/g,''));
	}
	const snum = Money.prettyString({amount, minimumFractionDigits, maximumFractionDigits, maximumSignificantDigits});
	const currencyCode = ((amount || 0).currency || 'GBP').toUpperCase();
	return (
		<span className="money">
			<span className="currency-symbol">{Money.CURRENCY[currencyCode]}</span>
			<span className="amount">{snum}</span>
		</span>
	);
};


/**
 * Handle a few formats, inc gson-turned-a-Time.java-object-into-json
 * null is also accepted.
 */
Misc.Time = ({time}) => {
	if ( ! time) return null;
	try {
		if (_.isString(time)) {
			return <span>{new Date(time).toLocaleDateString()}</span>;
		}
		if (time.ut) {
			return <span>{new Date(time.ut).toLocaleDateString()}</span>;
		}
		return <span>{printer.str(time)}</span>;
	} catch(err) {
		return <span>{printer.str(time)}</span>;
	}
};


/**
 * @Deprecated - use <Icon />
 * 
 * A Logo for a known web service - eg Twitter, Facebook, Instagram, "this app"
 * TODO transparent/opaque (??? -RM)
 * TODO merge with Misc.Icon
 * @param {String} service e.g. "twitter"
 * @param {?String} url Can be used instead of `service` to provide an img link. 
 * If service and url are blank, return null.
 * @param {Boolean} color True: Use the service's brand colour as foreground colour
 * @param {Boolean} square True: Put the logo inside a rounded square
 * @param {String} size - e.g. lg (33% bigger) or '2x', '3x' etc
 */
Misc.Logo = ({service, url, size, color = true, square = true, className}) => {
	if ( ! service && ! url) {
		console.warn("No Logo");
		return null;
	}
	// Social media - We can handle these services with FontAwesome icons
	if (service && 'twitter facebook instagram'.indexOf(service) !== -1) {
		const className = space(className, color? 'color-' + service : null);
		const fa = service + (square ? '-square' : '');
		const faSize = (size === 'xsmall') ? null : (size === 'small') ? '2x' : '4x'; // default to xlarge size, allow normal or large
		return <Misc.Icon className={className} fa={fa} prefix={Misc.FontAwesome===5?'fab':"fa"} size={faSize} />
	};

	// The rest we have to use images for (Instagram's mesh gradient can't be done in SVG)
	let file = url || '/img/' + service + '-logo.svg';
	if (service === 'instagram') file = '/img/instagram-logo.png';
	else if (service === C.app.id) file = C.app.logo;

	let classes = space('rounded logo' + (size ? ' logo-' + size : ''), className);

	return <img alt={service} data-pin-nopin="true" className={classes} src={file} />;
}; // ./Logo


/**
 * @Deprecated - use <Icon /> from Icon.jsx
 * 
 * Font-Awesome or Glyphicon icons. See also Misc.Logo
 * @param {String} fa Font Awesome icon name, e.g. "twitter" or "star"
 * @param {String} prefix Font Awesome v5 prefix e.g. "fab" for brands
 */
Misc.Icon = ({glyph, fa, size, className, prefix = 'fa', ...rest}) => {
	// FontAwesome favours <i>
	const Tag = glyph ? 'span' : 'i';
	const classes = glyph ? ['glyphicon glyphicon-' + glyph] : [prefix, 'fa-' + fa];

	if (size) {
		classes.push('fa-' + size);
	}
	if (className) classes.push(className);

	return <Tag className={classes.join(' ')} aria-hidden="true" {...rest} />;
};



/**
 * Try to make a thumbnail image for a data item by checking: logo, img, image
 */
Misc.Thumbnail = ({item, className}) => {
	if ( ! item) return null;
	let img = getLogo(item);
	return <Misc.ImgThumbnail url={img} alt={item.name || item.id || "thumbnail"} className={className} />;
};


const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const YEAR = 365 * DAY;


Misc.RelativeDate = ({date, noUpdate, Tag = 'span', ...rest}) => {
	const [update, setUpdate] = useState();

	if (!date) return null;
	const dateObj = (date instanceof Date) ? date : new Date(date);
	const now = new Date();

	let diff = now.getTime() - dateObj.getTime();

	const absoluteDate = dateObj.toLocaleString('en-GB');
	let count = '';
	let counter = '';
	let relation = (diff >= 0) ? 'ago' : 'in the future';

	const calcCount = (timeUnit) => Math.round(diff / timeUnit);

	diff = Math.abs(diff);
	if (diff > YEAR) {
		count = calcCount(YEAR);
		counter = 'year';
	} else if (diff > 4 * WEEK) {
		// months is fiddly, so let Date handle it
		count = (now.getMonth() - dateObj.getMonth()) + (12 * (now.getYear() - dateObj.getYear()));
		counter = 'month';
	} else if (diff > WEEK) {
		count = calcCount(WEEK);
		counter = 'week';
	} else if (diff > DAY) {
		count = calcCount(DAY);
		counter = 'day';
	} else if (diff > HOUR) {
		count = calcCount(HOUR);
		counter = 'hour';
	} else if (diff > MINUTE) {
		count = calcCount(MINUTE);
		counter = 'minute';
	} else if (diff > SECOND * 10) {
		count = calcCount(SECOND);
		counter = 'second';
	} else {
		relation = 'just now'; // no count, no counter
	}

	if (count > 1) {
		counter += 's';
	}

	useEffect(() => {
		if (noUpdate) return;
		const timeout = setTimeout(() => setUpdate(!update), diff);
		return () => clearTimeout(timeout);
	}, [update]);

	return <Tag title={absoluteDate} {...rest}>{count} {counter} {relation}</Tag>;
};


Misc.LongDate = ({date, noWeekday}) => {
	if (!date) return null;
	if (_.isString(date)) date = new Date(date);
	const weekday = noWeekday ? '' : WEEKDAYS[date.getDay()];
	return <time dateTime={date.toISOString()}>{weekday + ' '}{date.getDate()} {MONTHS[date.getMonth()]} {date.getFullYear()}</time>;
};

/**
 * Print a date with more specificity the closer it is to the present. Omits year for dates in the current year.
 * TODO Generalise to future dates, allow a different reference point to "now"
 * TODO Either fine tuning (eg can probably omit day-of-month ~90 days out) or options
 */
Misc.RoughDate = ({date}) => {
	if (!date) return null;
	if (_.isString(date) || _.isNumber(date)) date = new Date(date);
	const now = new Date();
	 // No, we don't care about leap seconds etc. 86400 seconds per day is fine.
	const thisYear = now.getFullYear() === date.getFullYear();
	const daysSince = (now.getTime() - date.getTime()) / 86400000;

	const time = daysSince > 2 ? null : (oh(date.getHours()) + ':' + oh(date.getMinutes())); // yesterday/today? show time
	const day = thisYear ? date.getDate() : null; // just month+year if last year or older
	const month = MONTHS[date.getMonth()]; // always show month
	const year = thisYear ? null : date.getFullYear(); // no year if it's the same

	return <time dateTime={date.toISOString()}>{[time, day, month, year].filter(a => a).join(' ')}</time>;
};

/**
 * Display a duration between 2 dates
 * e.g. March - May 2019
 * Only displays duration in months
 */
Misc.DateDuration = ({startDate, endDate, invisOnEmpty}) => {
	if (!startDate && !endDate) {
		if (!invisOnEmpty) return null;
		else return <span className="invisible">No date</span>
	}
	if (_.isString(startDate) || _.isNumber(startDate)) startDate = new Date(startDate);
	if (_.isString(endDate) || _.isNumber(endDate)) endDate = new Date(endDate);
	let durationString = "";
	// Optimise display of date for niceness
	if (startDate && !endDate) {
		// If only a start date is provided
		// e.g. May 2020
		durationString = MONTHS[startDate.getMonth()] + " " + startDate.getFullYear();
	} else if (!startDate && endDate) {
		// If only an end date is provided
		// e.g. May 2020
		durationString = MONTHS[endDate.getMonth()] + " " + endDate.getFullYear();
	} else if (startDate.getFullYear() === endDate.getFullYear()) {
		if (startDate.getMonth() === endDate.getMonth()) {
			// If the dates lie on the same month and year
			// e.g. May 2020
			durationString = MONTHS[startDate.getMonth()] + " " + startDate.getFullYear();
		} else {
			// If the dates lie on the same year and different months
			// e.g. June - November 2020
			durationString = MONTHS[startDate.getMonth()] + " - " + MONTHS[endDate.getMonth()] + " " + startDate.getFullYear();
		}
	} else if (startDate.getMonth() == endDate.getMonth()) {
		// If the dates lie on the same month of different years
		// e.g. August 2018 - 2019
		durationString = MONTHS[startDate.getMonth()] + " " + startDate.getFullYear() + " - " + endDate.getFullYear();
	} else {
		// If the dates are entirely different
		// e.g. May 2019 - June 2020
		durationString = MONTHS[startDate.getMonth()] + " " + startDate.getFullYear() + " - " + MONTHS[endDate.getMonth()] + " " + endDate.getFullYear();
	}

	return <span>{durationString}</span>
}


/**
 * Human-readable, unambiguous date+time string which doesn't depend on toLocaleString support
 */
Misc.dateTimeTag = (d) => d?
	<time datetime={d.toISOString()}>{dateTimeString(d)}</time> : null;

/**
 * Human-readable, unambiguous date string which doesn't depend on toLocaleString support
 * @param {?Date} date
 */
Misc.DateTag = ({date}) => {	
	if ( ! date) return null;
	date = asDate(date);	
	return <time dateTime={isoDate(date)}>{date.getDate()} {shortMonths[date.getMonth()]} {date.getFullYear()}</time>;
};

Misc.AvatarImg = ({peep, ...props}) => {
	if ( ! peep) return null;
	let { img, name } = peep;
	let { className, alt, ...rest} = props;
	const id = getId(peep);
	name = name || (id && XId.id(id)) || 'anon';
	alt = alt || `Avatar for ${name}`;

	if ( ! img) {
		// try a gravatar -- maybe 20% will have one c.f. http://euri.ca/2013/how-many-people-use-gravatar/index.html#fnref-1104-3
		if (id && XId.service(id) === 'email') {
			let e = XId.id(id);
			img = 'https://www.gravatar.com/avatar/'+md5(e.toLowerCase());
		}
		// security paranoia -- but it looks like Gravatar dont set a tracking cookie
		// let html = `<img className="AvatarImg" alt=${'Avatar for '+name} src=${src} />`;
		// return <iframe title={nonce()} src={'data:text/html,' + encodeURIComponent(html)} />;
	}

	return <img className={`AvatarImg img-thumbnail ${className}`} alt={alt} src={img} {...rest} />;
};


/**
 *
 * @param {
 * 	url: {?String} The image url. If falsy, return null
 * 	style: {?Object} Use to override default 100px width & height
 * 	background: {?String} convenience for style={{background}}, since that's commonly needed for handling transparency
 * }
 * @return {JSX}
 */
Misc.ImgThumbnail = ({url, alt, background, style, className = ''}) => {
	if (!url) return null;
	// add in base (NB this works with style=null)
	style = Object.assign({width: '100px', height: '100px', objectFit: 'contain', padding: 0}, style);
	if (background) style.background = background;
	const suppressAccWarnings = DataStore.getUrlValue("suppressAccWarnings");
	if (!suppressAccWarnings && (!alt || !alt.length)) {
		console.warn("Image with no alt text! All images must have alt text for accessibility.");
	}
	return <img className={space('img-thumbnail',className)} style={style} alt={alt || 'thumbnail'} src={url} />;
};


Misc.VideoThumbnail = ({url, width=200, height=150, controls=true}) => url ? (
	<video className="video-thumbnail" width={width} height={height} src={url} controls />
) : null;


/**
 * A help note for the user
 */
Misc.Help = ({children}) => {
	return <Alert color="info" className="m-1"><h3 className="pull-right m-1">&#9432;</h3>{children}</Alert>
};


/**
 * A button that you can only click once, until it clears.
 * 
 * @param {Object} p
 * @param {?Object[]} p.formData
 * @param {?String[]} p.path DataStore path to the form-data to submit. Set this OR formData
 * @param {Boolean} p.once If set, this button can only be clicked once.
 * @param {?Function} p.onClick If set (eg instead of `url`), call this with ({data})
 * @param {?Boolean|string} p.confirmSubmit If set, show a confirm dialog
 * @param responsePath {?String[]} If set, the (JSend unwrapped) response data will be set in DataStore here.
 * @param onSuccess {JSX} TODO rename this! shown after a successful submit. This is not a function to call!
 */
Misc.SubmitButton = SubmitButton;

/**
 * A copy-to-clipboard Button.
 * @param {Object} p
 * @param {String} p.text The text to copy on-click
 */
 export const CopyToClipboardButton = ({text, ...params}) => 
 	<Button {...params} disabled={ ! text} 
		 title="Copy to clipboard"
		onClick={e => stopEvent(e) && copyTextToClipboard(text)}><Icon name="clipboard"/></Button>;


/**
 * Expect children to have an "option" property which should match the "selected" attribute
 */
Misc.Tabs = ({children, path}) => {
	// TODO replace path with useState here
	// Option currently selected
	// Could use state hook for this, but would be inconsistent with the rest of the code base
	const selected = DataStore.getValue(path) || children[0].props.option;

	// Options to display
	const headers = children.reduce((headers, child) => [...headers, child.props.option], []);

	// Mark component selected, or the first option as a default
	const headerElements = headers.map(h => {
		const onClick = () => DataStore.setValue(path, h);
		const active = selected === h ? 'active' : null;
		return (
			<NavItem>
				<NavLink className={active} id={h} key={h} onClick={onClick}>{h}</NavLink>
			</NavItem>
		);
	});

	// Show the currently-active child - or an error message if the data-path specifies a nonexistent one
	const activeChild = children.find(child => child.props.option === selected) || `Missing tab: ${selected}`;

	// https://getbootstrap.com/docs/4.4/components/navs/#javascript-behavior
	// NB: In BS, tab-content and tab-pane are used to manage show/hide -- which we do here in jsx instead
	return <>
		<Nav tabs>{ headerElements }</Nav>
		<div>{ activeChild }</div>
	</>;
};


Misc.CheckAccess = ({can = 'edit'}) => {
	let pvCan = Roles.iCan(can);
	if ( ! pvCan.resolved) {
		return <Misc.Loading text="Checking your access permissions..." />;
	}	
	const canEdit = pvCan.value;	
	if (canEdit) return null;
	if (pvCan.error) {
		return <ErrAlert error={pvCan.error} color="danger" />;
	}
	return <><h1>Access Denied</h1><p>You do not have sufficient permissions to view this page. If you think you should have access, please contact an administrator about your roles ({str(Roles.getRoles().value)}).</p></>;
}


Misc.LoginToSee = ({desc}) => <div>Please log in to see {desc||'this'}. <LoginLink className="btn btn-secondary" /></div>;


/**
 * Interleave <wbr> elements in a string that uses . or _ instead of spaces to enable line breaking.
 * @param {string} text Raw text to break up
 * @param {regex} regex Alternative regex to break the string on
 * @returns {JSX.Element[]} E.g. VERY_LONG_STRING --> VERY<wbr/>_<wbr/>LONG<wbr/>_<wbr/>STRING
 */
Misc.FixBreak = ({text, regex = /([^._]+|[._]+)/g}) => {
	// why cache this with useState??
	const [broken] = useState(() => {
		let nodes = [];
		text.match(regex).forEach((group, index) => {
			if (index) nodes.push(<wbr key={"wbr"+index} />);
			nodes.push(<span key={"s"+index}>{group}</span>);
		});
		return nodes;
	});

	return broken;
}


export default Misc;
