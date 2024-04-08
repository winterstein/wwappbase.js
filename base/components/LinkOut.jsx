import React, { useState } from 'react';
import DataStore from '../plumbing/DataStore';
import { space } from '../utils/miscutils';

/**
 * Just a convenience for an `<a>` tag to an external (potentially untrustworthy e.g. it might do referrer tracking) web page, which opens in a new tab.
 * @param {Object} p
 * @param {?string} p.href If unset, return a `span` not an `a`. 
 * Convenience HACK: If this is a domain name, e.g. "bbc.co.uk", patch it by adding "https://"
 */
const LinkOut = ({href, disabled, children, className, fetchTitle, ...props}) => {
	if (disabled || ! href) {
		return <span className={space(disabled&&"text-muted",className)} {...props}>{children}</span>;
	}
	// fetch the link title
	if (fetchTitle) {
		// HACK via our LinkInfoServlet ??should we do this client side instead? CORS issues seem to get in the way
		const pvLinkInfo = DataStore.fetch(['misc','url',href], () => {
			return ServerIO.load("https://calstat.good-loop.com/linkInfo", {data:{url:href}, swallow:true});
		});
		children = href;
		if (pvLinkInfo.value && pvLinkInfo.value.title) {
			let pageTitle = pvLinkInfo.value.title;
			// HACK cleanup german g-docs
			pageTitle = pageTitle.replace("- Google Tabellen","");
			children = pageTitle;
			if ( ! props.title) props.title = href;
		}
	}

	// Does this look like a domain name with the protocol omitted? Very loose criterion: if there's a slash anywhere, use it verbatim.
	const fixedHref = href.match(/\//) ? href : `https://${href}`;

	return <a href={fixedHref} target="_blank" rel="noopener" rel="noreferrer" className={className} {...props} >{ children }</a>;
};
let citeCnt = 1;
/**
 * A citation / reference to an outside source (e.g. a link to Wikipedia, or to some reputable data source)
 */
export const Cite = ({href, title, ...props}) => {
	let [num] = useState(citeCnt++);
	return <LinkOut href={href} title={title} {...props}><sup>[{num}]</sup></LinkOut>;
}

export default LinkOut;
