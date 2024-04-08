import React, { useState } from 'react';
import { Button, Container, Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap';
import DataStore from '../plumbing/DataStore';
import { getScreenSize, isMobile, space, stopEvent } from '../utils/miscutils';
import ErrBoundary from './ErrBoundary';

/**
 * @param {JSX[]} children 1 to 3 elements, for left (optional), main, right. Use LeftSidebar, MainPain, RightSidebar
 * @param {?Boolean} showAll If true, then all panes are always shown -- on small devices: left as slide-out nav (TODO), right underneath.
 */
const Editor3ColLayout = ({ children, showAll }) => {
	if (children.length > 3) {
		console.error("Editor3ColLayout - Too many children", children);
	}
	return (<div className='Editor3ColLayout flex-row position-relative'>
		{children}
	</div>);
};

// margin-left 0 IF there is a LeftSidebar
const MainPane = ({ className, children }) => <Container className={className}><ErrBoundary>{children}</ErrBoundary></Container>;

const LeftSidebar = ({ children, hideOnMobile }) => {
	// If hideOnMobile is set, return nothing
	if (isMobile() && hideOnMobile == true) {
		return null;
	}

	// Show the mobile version of this (widget toggle)
	if (isMobile()) {
		let show = DataStore.getValue(['widget', 'LeftSidebar', 'show']);
		const toggle = e => stopEvent(e) && DataStore.setValue(['widget', 'LeftSidebar', 'show'], ! show);
		return (<>
			{!show && 
				<Button className="offcanvas-toggle" onClick={toggle} color="secondary">&gt;&gt;</Button>
			}
			<div className={space('offcanvas offcanvas-start', show && "show")}>
				<div className="offcanvas-header">
					<Button className="offcanvas-toggle" onClick={toggle} color="secondary" aria-label="Close">&lt;&lt;</Button>
				</div>
				<div className="offcanvas-body">{show && children}</div>
			</div>
		</>);
	}

	// Show the regular desktop version of this
	return <div className='mt-1 mr-0' style={{ maxWidth: "30%", position: "sticky", height: "100vh", top: 40 }} >{children}</div>; // TODO use a slide-out tray if space is limited
};
const RightSidebar = ({ children, width = "40vw", height = "100vh", overflowY = "scroll" }) => {
	return <div className='mt-1' style={{ position: "sticky", top: 40, width, height, overflowY }}><ErrBoundary>{children}</ErrBoundary></div>;
};

/**
 * TODO a slide-out tray, typically for in-page nav
 */
const Tray = ({ children }) => {
	return <div>{children}</div>;
};
export {
	LeftSidebar,
	MainPane,
	RightSidebar
}
export default Editor3ColLayout;