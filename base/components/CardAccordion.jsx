
import React, { useEffect, useState } from 'react';
import { Card as BSCard, CardHeader, CardBody, Button } from 'reactstrap';
import Misc from './Misc';
import DataStore from '../plumbing/DataStore';
import { space } from '../utils/miscutils';
import Icon from './Icon';


/**
 * A Bootstrap panel, with collapse behaviour if combined with CardAccordion.
 * This also provides some robustness via try-catch error handling.
 *
 * You can wrap these cards -- if you do, you MUST pass down misc parameters to enable the CardAccordion wiring to work. e.g.
 * <Foo {...stuff}> => <Card {...stuff}>
 * Note: If you see a card missing collapse controls -- this is probably the issue.
 *
 * @param {String|JSX} title - will be wrapped in h3 If this is null and titleChildren are null -- then there is no card header.
 * @param {?String} icon used with Misc.Icon
 * @param {?String} logo Url for a logo
 * @param {any} error - If set, colour the card red
 * @param {?string} warning - If set, colour the card yellow
 * @param {?String} className - Added to the BS panel classes
 * @param {?Boolean} collapse - If true, the children are not rendered. If used with uncontrolled, sets starting collapsed state.
 * @param {?Boolean} uncontrolled - Handle open/closed state internally
 */

class Card extends React.Component {
	/**
	 * Use a component to limit errors to within a card
	 */
	componentDidCatch(error, info) {
		this.setState({error, info});
		console.error(error, info);
		if (window.onerror) window.onerror("Card caught error", null, null, null, error);
	}

	constructor(props) {
		super(props);
		this.state = {
			stateCollapsed: props?.collapse
		}
	}

	render() {
		// ??HACK expose this card to its innards via a global
		// Card.current = this;

		let { title, glyph, icon, logo, children, className, style, onHeaderClick, collapse, warning, error, uncontrolled } = this.props;
		// no body = no card. Use case: so card guts (where the business logic often is) can choose to hide the card.
		// Note: null should be returned from the top-level. If the null is returned from a nested tag, it may not be null yet, leading to the card showing.
		if (!children) return null;

		const setStateCollapsed = (c) => {
			this.setState({stateCollapsed: c});
		}

		const {stateCollapsed} = this.state;

		const shouldCollapse = uncontrolled ? stateCollapsed : collapse;

		const color = error ? 'danger' : warning ? 'warning' : null;

		// Is the title something we can use as a tooltip as well?
		const titleText = _.isString(title) ? title : null;

		// Header modifiers
		let headerClasses = [];
		if (onHeaderClick || uncontrolled) headerClasses.push('btn btn-link');
		if (color) {
			headerClasses.push(`bg-${color}`);
			headerClasses.push(error ? 'text-white' : warning ? 'text-dark' : null)
		}

		// Error or warning to show user?
		const alert = (error && _.isString(error)) ? (
			<Icon name="warning" color="danger" title={error} className="mr-2" />
		) : (warning && _.isString(warning)) ? (
			<Icon name="warning" color="warning" title={warning} className="mr-2" />
		) : null;

		// Clickable header takes a caret to signify it's clickable
		const caret = onHeaderClick || uncontrolled ? (
			<Icon title={shouldCollapse?"expand":"collapse"} className="pull-right" name={`caret${shouldCollapse ? 'down' : 'up'}`} />
		) : null;

		let showHeader = title || glyph || icon || logo || alert || caret;

		const fullHeaderClick = (e) => {
			if (uncontrolled) setStateCollapsed(!stateCollapsed);
			if (onHeaderClick) onHeaderClick(e);
		}

		return (
			<BSCard color={color} outline className={space(className, 'mb-3')} style={style} >
				{showHeader && <CardHeader className={space(headerClasses)} onClick={fullHeaderClick} title={titleText}>
					{(glyph || icon) && <Icon glyph={glyph} name={icon} className="mr-2"/>}
					{title && <span className="mr-2">{title}</span>}
					{logo && <img className="logo-sm rounded" src={logo} />}
					{alert}
					{caret}
				</CardHeader>}
				{shouldCollapse ? null : <CardBody>{children}</CardBody>}
			</BSCard>
		);
	};
}; // ./Card


/**
 *
 * @param {?String} widgetName - Best practice is to give the widget a name.
 * @param {?Boolean} multiple - If true, allow multiple cards to stay open.
 * @param {Misc.Card[]} children
 *    children should be Misc.Card OR pass on ...other params to a Misc.Card. Otherwise the open/close clickers wont show.
 * @param {?Boolean} defaultOpen - Should all cards start open or closed? This is more normally set at the Card level.
 */
const CardAccordion = ({ children, multiple, defaultOpen}) => {
	// NB: accordion with one child is not an array
	if (!_.isArray(children)) children = [children];

	// filter null, undefined
	children = children.filter(x => !!x);

	const [opens, setOpens] = useState([true]); // default to first child panel open

	useEffect(() => {
		if (defaultOpen && !multiple) {
			console.warn("CardAccordion.jsx - defaultOpen=true without multiple=true is odd.");
		}
		if (defaultOpen !== undefined) {
			// start with all open/closed
			setOpens(children.concat().fill(defaultOpen));
		} else {
			// Child without props seen Aug 2019 on Calstat
			setOpens(React.Children.map(children, ({props}) => (props && !!props.defaultOpen)));
		}
	}, []);

	if (!children) return <div className="CardAccordion" />;

	assert(_.isArray(opens), "Misc.jsx - CardAccordion - opens not an array", opens);

	return (
		<div className="CardAccordion">
			{React.Children.map(children, (child, i) => {
				let collapse = !opens[i];
				let onHeaderClick = e => {
					// Not in multiple mode ? Close all other cards
					const newOpens = multiple ? opens.slice() : [];
					newOpens[i] = collapse;
					setOpens(newOpens);
				};
				// Clone child, adding collapse and header-click props
				return React.cloneElement(child, {collapse, onHeaderClick});
			})}
		</div>
	);
};

export default CardAccordion;
export {Card};
// HACK for older code
Misc.Card = Card;
Misc.CardAccordion = CardAccordion;

