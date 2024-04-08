import React from 'react';
import ServerIO from '../plumbing/ServerIOBase';
import C from '../CBase';
import { getId, getType } from '../data/DataClass';
import { encURI, space } from '../utils/miscutils';
import Roles from '../Roles';


/**
 * An internal link
 * @param {Object} p
 * @param {?boolean} devOnly
 */
const PortalLink = ({item,size,className,devOnly,children}) => {
	if (devOnly && ! Roles.isDev()) return null;
	let href = getPortalLink(item);
	if ( ! href) {
		return null;
	}
	return <C.A className={space(size,devOnly&&"dev-link",className)} href={href}>{children || item.name || item.id}</C.A>;
};

/**
 * 
 * @param {?DataItem} item 
 * @returns {?String} link or null
 */
export const getPortalLink = (item) => {
	if ( ! item) return null;
	const type = getType(item);
	if ( ! type) {
		console.warn("PortalLink - no type?!", item);
		return null;
	}
	let url = ServerIO.getEndpointForType(type);
	// HACK charity - edit in Portal
	url = url.replace("app.sogive.org/charity","portal.good-loop.com/ngo");
	url = url.replace("good-loop.com/", "good-loop.com/#"); // hack: switch from servlet to editor page
	let href = url+"/"+encURI(getId(item));
	return href;
};


export default PortalLink;
