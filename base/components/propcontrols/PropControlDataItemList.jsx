

import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import { Input, Row, Col, Dropdown, DropdownItem, DropdownMenu, DropdownToggle, Button, ButtonGroup } from 'reactstrap';

import ListLoad, {CreateButton} from '../ListLoad';

import C from '../../CBase';
import PropControl, { DSsetValue, PropControlParams, registerControl } from '../PropControl';
import ActionMan from '../../plumbing/ActionManBase';
import { getDataItem, getDataList, publish, saveEdits } from '../../plumbing/Crud';
import { getId, getName } from '../../data/DataClass';
import { assert, assMatch } from '../../utils/assert';
import { encURI, getLogo, space } from '../../utils/miscutils';
import {saveDraftFnFactory} from '../SavePublishDeleteEtc';
import { doShareThing } from '../../Shares';
import { A } from '../../plumbing/glrouter';
import DataItemBadge from '../DataItemBadge';
import KStatus from '../../data/KStatus';
import SearchQuery from '../../searchquery';
import PropControlList from './PropControlList';
import PropControlDataItem from './PropControlDataItem';
import DataStore from '../../plumbing/DataStore';
import List from '../../data/List';


const PropControlDataItemList2 = ({linkProp, linkValue, Viewer, canCreate, createProp="id", base, path, prop, proppath, rawValue, setRawValue, storeValue, modelValueFromInput, 
	type, itemType, status=KStatus.DRAFT, domain, list, sort, embed, pageSize=20, navpage, notALink, readOnly, showId=true,
}) => {
	if ( ! Viewer) {
		Viewer = ({item}) => <DataItemBadge item={item} href />;
	}
	let q = SearchQuery.setProp(null, linkProp, linkValue).query;
	let pvItems = getDataList({type:itemType, status, q});
	let debits = List.hits(pvItems.value) || [];

	const setItem = (id, remove, localItem) => {
		assMatch(id, String);
		// send a diff that sets the link
		let dummy = {};
		dummy[linkProp] = linkValue;
		let previous={};
		if (remove) { // flip to unset the link instead
			previous = dummy;
			dummy = {};
		}
		saveEdits({type:itemType, id, item:dummy, previous});
		// local edit
		// NB: probably in memory, but there could be a draft v published corner case
		let pvLocalItem = getDataItem({type:itemType, id, status:KStatus.DRAFT});
		if (pvLocalItem.value) {
			pvLocalItem.value[linkProp] = remove? null : linkValue;
		}
		// do we need to publish??
		let pvDebit = getDataItem({type:itemType, id, status}); // load so we know if its published or not
		pvDebit.promise.then(debit => {
			if (debit.status===KStatus.PUBLISHED || debit.status===KStatus.MODIFIED) {
				publish({item:debit}); // Not ideal ...but avoids a bug where old values (loaded via draft or pub) wont go away
			}
		});
		// ditch local list ??could we modify instead??
		DataStore.invalidateList(itemType);
		DataStore.update(); // redraw
	};

	/**
	 * @param {String[]} newList 
	 */
	const setList = (newList) => {
		// what's been removed?
		let removed = debits.filter(item => ! newList.includes(item.id));
		// NB called each time so only ever 1 change
		if (removed[0]) {
			setItem(removed[0].id, true);
		}
		// NB added should not be possible with the current setup
		let added = debits.filter(item => newList.includes(item.id));
		if (added[0]) {
			setItem(added[0].id);
		}
	};

	return <>
		<PropControlList itemType={itemType} value={debits} prop="TODO"
			set={setList}
			Viewer={Viewer} Editor={false} confirmDelete={false} canCreate={false}
		/>
		<PropControlDataItem itemType={itemType} q={linkProp+":unset"} set={setItem} canCreate={canCreate} />
	</>;
};


registerControl({ type: 'DataItemList', $Widget: PropControlDataItemList2 });


/**
 * A picker with auto-complete for e.g. Advertiser, Agency
 * @param {PropControlParams} p 
 * @param {!String} p.itemType
 * @param {?Object} p.base Used with canCreate, a base object for if a new item is created.
 * @param {?boolean} p.canCreate Offer a create button
 * @param {?String} p.createProp If a new item is created -- what property should the typed value set? Defaults to "id"
 * @param {String} p.linkProp e.g. jobNumber
 * @param {String} p.linkValue
 * @param {?String} p.status Defaults to PUB_OR_DRAFT
 * @param {?String} p.q Optional search query (user input will add to this). Usually unset.
 * @param {?String} p.list Optional list to use (instead of querying the server). Usually unset.
 * @param {JSX|boolean} p.Viewer {path, item, i} Set false to use the Editor.
 */
const PropControlDataItemList = (p) => <PropControl type="DataItemList" set={(a,b,c) => console.warn("TODO",a,b,c)} {...p} />;

export default PropControlDataItemList;
