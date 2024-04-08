
import React, { useState } from 'react';
import _ from 'lodash';
import { Input, Row, Col, Dropdown, DropdownItem, DropdownMenu, DropdownToggle, Button, ButtonGroup } from 'reactstrap';
import DataClass, { getId, getName, getType } from '../data/DataClass';
import { getDataItem } from '../plumbing/Crud';
import { encURI, getLogo, space } from '../utils/miscutils';
import KStatus from '../data/KStatus';
import { getPortalLink } from './PortalLink';


/**
 * 
 * @param {Object} p
 * @param {?String|boolean} p.href link to click to, or true for portal-editor-link
 * @param {?DataClass} p.item Specify item or id + type
 * @param {?string} p.id
 * @param {?string} p.type 
 * @param {?KStatus} p.status Only used if `item` isn't set.
 */
const DataItemBadge = ({item, id, type, status=KStatus.PUBLISHED, onClick, href, className, style, title, ...rest}) => {
	if (!item) item = getDataItem({type, id, status}).value || {id, type};

	const Tag = href ? 'a' : 'div';
	if (href === true) {
		href = getPortalLink(item);
	}
	if (!href) href = null; // avoid a react error message


	return <Tag className={space('DataItemBadge', className)} style={style}
		onClick={onClick} href={href} 
		title={title || getName(item) || `ID: ${getId(item)}`}
		{...rest}
	>
		{getLogo(item) ? <img src={getLogo(item)} className="logo logo-sm" /> : <span className="d-inline-block logo logo-sm" />}{' '}
		<span className="d-inline-block name">{getName(item) || getId(item)}</span>
	</Tag>;
};

// export const getDataItemLink = (item) => {
//     if ( ! item) return null;
//     const id = getId(item);
//     const type = getType(item);
//     if ( ! type || ! id) return null;
//     let glService = "portal";
//     return "https://"+glService+"good-loop.com/"+type.toLowerCase()+"/"+encURI(id);
// };

export default DataItemBadge;
