
import React, { useState } from 'react';
import PropControl from './PropControl';
import Misc from './Misc';
import { space, yessy } from '../utils/miscutils';

const FilterForm = () => <PropControl size="lg" prepend={<Misc.Icon fa="filter" />} label="Filter Controls"
					type="search"
					prop="uifilter"
					modelValueFromInput={v => v ? v.toLowerCase() : v}
					placeholder="e.g. &quot;logo&quot; or &quot;col&quot; -- partial words also work"
					help="There's a lot going on here! Type a keyword to find the controls you want."
				/>;

/**
 * wrapper for filtering by keyword. Works with FPropControl
 * @param {?String[]} keywords - space separated, optional, extra matching keywords
 * @param children typically a Card
 * ??what might stuff be?? use-case??
 */
const FCard = ({ children, keywords, ...stuff }) => {
	if (!children) return null;
	// pass down stuff
	children = React.Children.map(children, Kid => {
		return Kid ? React.cloneElement(Kid, stuff) : Kid;
	});

	const [match4Prop, setMatch4Prop] = useState({});
	FCard.currentSetMatch4Prop = setMatch4Prop;
	FCard.match4Prop = match4Prop;
	/** if true, all FPropControl children should render */
	FCard.cardMatch = false;
	const uifilter = DataStore.getUrlValue('uifilter');
	if (uifilter) {
		let matchedSomething = false;
		// card level match?
		if (keywords) {
			let cardMatch = keywords.split(/\s+/).find(w => w.startsWith(uifilter));
			if (yessy(cardMatch)) {
				matchedSomething = cardMatch;			
				FCard.cardMatch = true;
			}
		}
		// FPropControl matches (from a previous render)
		if ( ! yessy(matchedSomething)) {
			matchedSomething = FCard.match4Prop && Object.values(FCard.match4Prop).find(x => x);
		}
		if ( ! yessy(matchedSomething)) {
			// render (so we can compute matches) but hide 
			// NB a nice transition would be nice, the css below doesn't work yet, but oh well
			// console.log(filter, "No matchedSomething", keywords);
			return <div style={{ height: 0, transition: 'height 1s', overflow: 'hidden'/*display:'none'*/ }}>{children}</div>;
		}
		// console.log(filter, "matchedSomething", matchedSomething);
	}
	// normal: filter OK, show it
	return <>{children}</>;
};


/**
 * TODO if match => open the card
 * if filter and no match => close or hide the card
 *  -- use 2x run through react render
 * Also need a reset = "clear filter and close all but preview" button
 * 
 * Wrap PropControl in a filter
 * @param {?String} keywords - Additional keywords, space separated. Note: prop, label, help, value, warning, error already get used.
 */
const FPropControl = ({ keywords, ...stuff }) => {
	const uifilter = DataStore.getUrlValue('uifilter');
	if ( ! uifilter) {
		return <PropControl {...stuff} />;
	}
	const value = stuff.value || DataStore.getValue(stuff.path.concat(stuff.prop));
	let kw = space(stuff.prop, stuff.label, stuff.help, value, keywords, stuff.warning, stuff.error);
	// HACK for colour/color
	if (stuff.type === 'color') kw += " color colour";
	// matched?
	let match = kw.split(/\s+/).find(w => w.toLowerCase().startsWith(uifilter));
	if (FCard.currentSetMatch4Prop) {
		FCard.match4Prop[stuff.prop] = match;
		FCard.currentSetMatch4Prop(FCard.match4Prop);
	}	
	// NB a card-level keyword match is enough to display all prop-controls for that card
	return <div className={match? 'focus' : (FCard.cardMatch? null : 'nomatch')}><PropControl {...stuff} /></div>;
};

export {FPropControl, FCard, FilterForm}
