import React, { useState, useEffect } from 'react';
import { Navbar, NavbarToggler, NavItem, Collapse, Nav, Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

import { assMatch } from '../utils/assert';
import AccountMenu from './AccountMenu';
import C from '../CBase';
import DataStore from '../plumbing/DataStore';
import { equals, labeller, space, stopEvent } from '../utils/miscutils';
import { getDataItem } from '../plumbing/Crud';
import KStatus from '../data/KStatus';
import DataClass, { getId, getType } from '../data/DataClass';
import CloseButton from './CloseButton';
import { modifyPage } from '../plumbing/glrouter';


class NavProps {
	/** can contain nulls */
	pageLinks;
	currentPage;
	children;
	/**
	 * @type {?Boolean}
	 */
	darkTheme;
	/**
	 * @type {?String} a BS colour
	 */
	backgroundColour;
	homelink;
	isOpen;
	toggle;

	brandId;
	brandType;
	/**
	 * @type {?String} url for 2nd brand home page
	 */
	brandLink;
	/**
	 * @type {?String} logo for 2nd brand
	 */
	brandLogo;
	/**
	 * @type {?String} name for 2nd brand
	 */
	brandName;
	/**
	 * @type {?Any} other renderables to display on the right side
	 */
	extraContent;
};


/**
 * Used via setNavContext()
 * @param {NavProps|DataClass} props e.g. brandLink brandName brandLogo, or an Advertiser or NGO
 */
export const setNavProps = (props) => {
	// useEffect(() => { // No - this causes a "Rendered more hooks than during the previous render." error
	// extract props from a DataItem
	if (DataClass.isa(props)) {
		// This does NOT set the context, as used by ListItems
		const item = props;
		props = { // advertiser link and logo
			brandId: getId(item),
			brandType: getType(item),
			brandLink: String(window.location),
			// NB: prefer white silhouette for safe colours vs backdrop. HACK expects branding object
			brandLogo: item.branding ? (item.branding.logo_white || item.branding.logo) : item.logo,
			brandName: item.name || getId(item)
		};
	}

	// Loop protection - no update if new props are identical
	if (equals(getNavProps(), props)) return;

	DataStore.setValue(['widget', 'NavBar'], props);
	// }, [JSON.stringify(props)]); // No useEffect
};


/**
 * 
 * @returns {?NavProps}
 */
export const getNavProps = () => DataStore.getValue(['widget','NavBar']) || DataStore.setValue(['widget','NavBar'], {}, false);


/**
 * rendered within BS.Nav
 * @param {NavProps} p
 * isBeta HACK to place a beta label over the logo for SoGive Mar 2022
 */
function DefaultNavGuts({pageLinks, currentPage, children, logoClass='logo', homelink, isOpen, toggle,
	brandId, brandType, brandLink, brandLogo, brandName,
	onLinkClick, isBeta, accountMenuItems, accountLinkText, noLogins})
{
	return (<>
		<C.A href={homelink || '/'} className="navbar-brand" title={space(C.app.name, "- Home")} onClick={onLinkClick}>
			<img className={space(logoClass, C.app.logoMobile && "d-none d-md-inline-block")} alt={C.app.name} src={C.app.homeLogo || C.app.logo} />
			{C.app.logoMobile && <img className={space(logoClass, "d-md-none")} alt={C.app.name} src={C.app.logoMobile} />}
			{isBeta && <span style={{position:'sticky',top:'100%',color:'grey'}}>beta</span>}
		</C.A>
		{brandLink && (brandLogo || brandName) && // a 2nd brand?
			<div className="position-relative">
				<C.A href={brandLink} className="navbar-brand" onClick={onLinkClick}>
					{brandLogo? <img className={space(logoClass, "brand-logo")} alt={brandName} src={brandLogo} /> : brandName}
				</C.A>
				{brandType && brandId
					&& <CloseButton style={{position:"absolute", bottom:0, right:"-0em"}} className="text-white"
						onClick={e => stopEvent(e) && setNavContext(brandType, null, true, brandLink)} size="sm"
						tooltip={`include content beyond ${brandName}'s micro-site`} />}
			</div>
		}
		<NavbarToggler onClick={toggle}/>
		<Collapse isOpen={isOpen} navbar>
			<div className="collapsibles mx-2 w-100 d-flex justify-content-between">
				<Nav navbar className="page-links justify-content-start" style={{flexGrow:1}}>
					{pageLinks}
				</Nav>
				{!noLogins &&
				<div className="d-flex align-items-center">
					{children}
					<AccountMenu active={currentPage === 'account'} accountMenuItems={accountMenuItems} accountLinkText={accountLinkText} onLinkClick={onLinkClick} className=""/>
				</div>}
			</div>
		</Collapse>
	</>);
}


/**
 * @param {NavProps} props
 * @param {?String} currentPage e.g. 'account' Read from window.location via DataStore if unset.
 * @param {?String} homelink Relative url for the home-page. Defaults to "/"
 * @param {String[]} pages
 * @param {?Object} externalLinks Map page names to external links.
 * @param {?String[]|Function|Object} labels Map options to nice strings.
 * @param {?boolean} darkTheme Whether to style navbar links for a dark theme (use with a dark backgroundColour)
 * @param {?String} backgroundColour Background colour for the nav bar.
 */
function NavBar({NavGuts = DefaultNavGuts, accountMenuItems, accountLinkText, children, expandSize = "md", ...props}) {
	// allow other bits of code (i.e. pages below MainDiv) to poke at the navbar
	const navProps = getNavProps();
	if (navProps) Object.assign(props, navProps);

	let {currentPage, pages, labels, externalLinks, darkTheme, shadow, backgroundColour} = props; // ??This de-ref, and the pass-down of props to NavGuts feels clumsy/opaque

	// Handle nav toggling
	const [isOpen, setIsOpen] = useState(false); // what is open?? the whole menu (mobile) or a dropdown??
	const close = () => setIsOpen(false);
	const toggle = () => setIsOpen(!isOpen);

	const [scrolled, setScrolled] = useState(false);
	useEffect(() => {
		const checkScroll = () => setScrolled(window.scrollY > 50);
		checkScroll();
		window.addEventListener('scroll', checkScroll);
		return () => window.removeEventListener('scroll', checkScroll);
	}, []);

	// Fill in current page by inference from location
	if (!currentPage) {
		let path = DataStore.getValue('location', 'path');
		currentPage = path && path[0];
	}

	// If the pages are just a list of strings, we can simplify the render process
	const simplePagesSetup = Array.isArray(pages);
	const labelFn = labeller(pages, labels);

	// Close navbar on item selection
	const onLinkClick = () => close();

	/**
	 * @param {Object} p
	 * @param {!String} p.page
	 * @param {!String|JSX} p.children
	 */
	const PageNavLink = ({page, className, children}) => {
		let pageLink = DataStore.localUrl + page.replace(/\s/, '-');
		if (externalLinks && page in externalLinks) pageLink = externalLinks[page];
		return (
			<C.A className={space("nav-link", className)} href={pageLink} onClick={onLinkClick} >
				{children}
			</C.A>
		);
	};

	// make the page links
	// Accepts a page links format as:
	// {title1: [page1, page2, ...], page3:[], ...}
	// for dropdowns, or, for simpler setups, just an array of strings

	const NLink = ({page, isTop}) => {
		assMatch(page, String);
		// Don't put NavItems inside dropdowns! React screams at us about incorrectly nesting <li> elements.
		const Item = isTop ? NavItem : DropdownItem;
		return (
			<Item key={page} className={isTop && 'top-level'} active={page === currentPage}>
				<PageNavLink page={page} >
					{labelFn(page)}
				</PageNavLink>
			</Item>
		);
	};

	const NDropDown = ({title, i}) => {
		const [open, setOpen] = useState(false);
		return <Dropdown isOpen={open} toggle={() => setOpen(!open)} key={title} nav inNavbar className='top-level'>
			<DropdownToggle nav caret>{labelFn(title)}</DropdownToggle>
			<DropdownMenu>
				{pages[title].filter(page => page).map((page, j) => (
					<NLink key={page} page={page} />
				))}
			</DropdownMenu>
		</Dropdown>;
	};

	let pageLinks;
	if (simplePagesSetup) {
		pageLinks = pages.map((page,i) => <NLink key={page} page={page} isTop />);
	} else {
		pageLinks = Object.keys(pages).map((title, i) => {
			// Some page links can come in collections - make sure to account for that
			let subPages = pages[title];
			if ( ! title || subPages===false) {
				return null; // switched off e.g. not logged in or type of user
			}
			if (subPages && subPages.length) {
				return <NDropDown title={title} i={i} key={title}/>
			}
			// Title is a single page, not a category
			return <NLink key={title} page={title} isTop />;
		});
	} // ./pageLinks

	return (
		<Navbar sticky="top" dark={darkTheme} light={!darkTheme} color={backgroundColour} expand={expandSize} className={space('p-1', scrolled && "scrolled")} >
			<NavGuts {...props} pageLinks={pageLinks} isOpen={isOpen} toggle={toggle} onLinkClick={onLinkClick} accountMenuItems={accountMenuItems} accountLinkText={accountLinkText}>
				{children}
			</NavGuts>
		</Navbar>
	);
}
// ./NavBar


const CONTEXT = {};


/** Clear extra nav branding */
const setNavPropsBlank = () => setNavProps({
	brandId: null,
	brandType: null,
	brandLink: null,
	brandLogo: null,
	brandName: null
});


// TODO unify with setNavProps() to avoid (re)setting one and not the other.
export const setNavContext = (type, id, processLogo, itemLink) => {
	CONTEXT[type] = id;
	if (!processLogo) return;
	// Remove context item?
	if (!id) {
		// If viewing the page for the context item, return to the list for that item type
		if (itemLink === String(window.location)) {
			const path = DataStore.getValue(['location', 'path']);
			if (path.length > 1) modifyPage(path.slice(0, -1));
		}
		// If there are other items in nav-context, fall back to showing one of them
		// (rather than silently & opaquely filtering lists)
		Object.entries(CONTEXT).find(([k, v]) => {
			if (!v) return false;
			type = k;
			id = v;
			return true;
		});
		if (!id) return setNavPropsBlank(); // Nothing else in context, just clear branding.
	}
	// Fetch full context-item & apply branding to nav bar
	// NB: bug Oct 2022: KStatus.PUB_OR_DRAFT was over-writing draft data
	getDataItem({type, id, status: KStatus.PUBLISHED, swallow: true}).promise
	.then(item => {
		if (item) return setNavProps(item);
		console.warn(`setNavContext: No item for ${type}:${id} PUBLISHED`);
		setNavPropsBlank();
	});
};


/**
 * @param {C.TYPES} type
 * @returns {?String} id E.g. an advertiser id
 */
export const getNavContext = (type) => {
	return CONTEXT[type];
};


export default NavBar;
export {
	NavProps
};
