import React, { useState } from 'react';
import { Nav, NavItem, Dropdown, DropdownToggle, DropdownMenu, DropdownItem, NavLink } from 'reactstrap';
import Login from '../youagain';

import C from '../CBase';
import DataStore from '../plumbing/DataStore';
import {LoginLink, RegisterLink, LogoutLink} from './LoginWidget';

// import {XId,yessy,uid} from '../js/util/orla-utils.js';

import Misc from './Misc';
import { space, isMobile } from '../utils/miscutils';
import XId from '../data/XId';
import { modifyPage } from '../plumbing/glrouter';


/**
The top-right menu
@component
@param {Object} p
@param {boolean} p.active true if on the account page
@param {boolean} p.account true if we want to show the account option (true by default), needed by my-loop because it doesn't have an account page but needs logout
@param {string} p.logoutLink what page should be loaded after logout ('#dashboard' by default), to allow it to go to the dashboard in portal, but the same page in my-loop
@param {?{string:page, String:label}[]} p.accountMenuItems Add optional items to the account menu - used in MyGL/MyData where we show settings etc on the account page body (those don't fit into the layout mobile)
@param {string} linkType HACK: Set to "C.A" for <C.A /> hrefs, "a" for normal hrefs. Fixes bug in T4G in which it wasn't loading the links correctly (since it's in an iFrame presumably)

*/
const AccountMenu = ({active, accountMenuItems, children, accountLinkText="Account", canRegister, customLogin, className, logoutLink, onLinkClick, style, small, accountLink, linkType="C.A", customImg, noNav, shareWidget, ...props}) => {
	const [open, setOpen] = useState(false);
	const onClickFn = () => {
		setOpen(!open);
		onLinkClick && onLinkClick();
	}
	let $LoginLink = customLogin ? customLogin : <LoginLink className="p-2">Sign in</LoginLink> ;

	// TODO see navbar dropdown
	if ( ! Login.isLoggedIn()) {
		// why justify-content-end??
		return (
			<Nav navbar style={props.style} className={space("justify-content-end", className)}>
				{ ! canRegister && <NavItem id="register-link"><RegisterLink /></NavItem>}
				<NavItem className="login-link">{$LoginLink}</NavItem>
			</Nav>
		);
	}

	let user = Login.getUser();
	const accountHref = accountLink || {};
	const name = small ? ((user.name && user.name.substr(0, 1)) || XId.prettyName(user.xid).substr(0,1)) : (user.name || XId.prettyName(user.xid));
	const Wrapper = noNav ? 'div' : Nav;

	return (
	<Wrapper navbar={Wrapper===Nav? true : null /* stop React complaining about div+navbar*/} style={style} className={space("account-menu d-flex", className)}>
		{shareWidget && shareWidget}
		<Dropdown isOpen={open} toggle={() => setOpen(!open)} nav={!noNav} inNavbar={!noNav}>
			<DropdownToggle nav caret>{customImg ? <img src={customImg} className="custom-img"/> : name}</DropdownToggle>
			<DropdownMenu>
				{accountMenuItems && accountMenuItems.map((item, i) => {
					return <div key={i}>
						<DropdownItem >
						{linkType == "C.A"
							? <C.A href={modifyPage(["account"],{tab: item.page}, true, true)} className="nav-link" onClick={onClickFn}>{item.label}</C.A> 
							: <a href={modifyPage(["account"],{tab: item.page}, true, true)} className="nav-link" onClick={onClickFn}>{item.label}</a> 
						}
						</DropdownItem>
					</div>
				})}
				{accountMenuItems && <DropdownItem divider />}
				{children}
				{(children && children.length) && <DropdownItem divider />}
				<DropdownItem>
					{logoutLink ? logoutLink : <LogoutLink className="nav-link">Logout</LogoutLink>}
				</DropdownItem>
			</DropdownMenu>
		</Dropdown>
	</Wrapper>
	)
};

export default AccountMenu;
