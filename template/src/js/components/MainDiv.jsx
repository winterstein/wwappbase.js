/* global navigator */
import React from 'react';
import Login from '../base/youagain';

// Plumbing
import Roles from '../base/Roles';
import C from '../C';

// Templates

// Pages
import MainDivBase from '../base/components/MainDivBase';
import ServerIO from '../plumbing/ServerIO';

// DataStore
C.setupDataStore();

// // Person from profiler
// ServerIO.USE_PROFILER = true;

// Actions

const PAGES = {
};

// ?? switch to router??
// const ROUTES = {
// 	"/": MyPage,
// 	"/impact": CampaignPage, 
// };

addFunderCredit("Scottish Enterprise");
addDataCredit({ name: "The charity impact database", url: "https://sogive.org", author: "SoGive" });

Login.app = C.app.id;
Login.dataspace = C.app.dataspace;

const MainDiv = () => {

	const navPageLabels = {
	};

	return (<MainDivBase 
		pageForPath={PAGES}
		defaultPage="home"
		// Footer={Footer}
	></MainDivBase>);
};

export default MainDiv;
