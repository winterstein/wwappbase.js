import React from "react";
import MDText from "./MDText";
import { assert } from "../utils/assert";
import NGO from '../../base/data/NGO';


/**
 * Display a charity description
 * @param {NGO} ngo
 * @param {?Bool} summarize use the summary description
 * @param {?Bool} extended use the extended description
 * @returns 
 */
const NGODescription = ({ngo, summarize, extended}) => {
	//assert(NGO.id(ngo), ngo);

	if (!ngo) {
		console.warn("No NGO for description??");
		return null;
	}

	let desc;
	if (summarize) desc = NGO.summaryDescription(ngo);
	else if (extended) desc = ngo.extendedDescription || ngo.description || ngo.summaryDescription;
	else desc = ngo.description || ngo.summaryDescription || ngo.extendedDescription;

	return <MDText source={desc}/>;

};

export default NGODescription;
