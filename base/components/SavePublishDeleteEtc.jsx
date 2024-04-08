import React, { useEffect, useState } from 'react';
import { Button, ButtonDropdown, DropdownMenu, DropdownToggle, DropdownItem } from 'reactstrap';
import { debounce, isFunction } from 'lodash';

import { assert, assMatch } from '../utils/assert';
import Misc from './Misc';
import DataStore from '../plumbing/DataStore';
import ActionMan from '../plumbing/ActionManBase';
import C from '../CBase';
// // import I18n from 'easyi18n';
import DataClass, { getType, getId, nonce, getStatus, getName } from '../data/DataClass';
import Messaging, { notifyUser } from '../plumbing/Messaging';
import { publish, saveEdits } from '../plumbing/Crud';
import Icon from './Icon';
import { goto, modifyPage } from '../plumbing/glrouter';
import Login from '../youagain';
import { Help } from './PropControl';
import { getObjectValueByPath, setObjectValueByPath } from '../utils/miscutils';



/**
 * 
 * @param {*} item 
 * @param {String} action
 * @throws Error to cancel
 */
const confirmUserAction = ({ item, action }) => {
	let name = DataClass.getName(item) || getId(item);
	let ok = confirm(`Are you sure you want to ${action} ${name}?`);
	if (!ok) {
		throw new Error(`User cancelled ${action}`);
	}
	return true;
};


/**
 * Save if no edits for 2 seconds
 * ?? It'd be nice if this was modifiable, but that is a faff with the debounced functions
 */
const DEBOUNCE_MSECS = 2000;


/**
Problem: we can't keep making fresh copies 'cos that breaks debounce. But we can't share a fn either!
Solution TODO cache versions of it.
?? useState() would probably be a neater solution
 */
const _saveDraftFn4typeid = {};


/** 
 * Hack: a debounced auto-save function for the save/publish widget.
 * @param {Object} p
 * @param {!String} p.type
 * @param {!String} p.key
 * @returns {Function}
*/
const saveDraftFnFactory = ({type, key}) => {
	assMatch(type, String);
	assMatch(key, 'String|Number');
	const k = type+key;
	let sdfn = _saveDraftFn4typeid[k];
	if (!sdfn) {
		const rawFn = ({type, id, item, previous}) => {
			// console.log("...saveDraftFn :)");
			let pv = saveEdits({ type, id, item, previous, swallow: true });
			// TODO how can we capture errors and show them on the save button??
			return true;
		};
		sdfn = debounce(rawFn, DEBOUNCE_MSECS);
		_saveDraftFn4typeid[k] = sdfn;
	}
	return sdfn;
};


/**
 * A debounced auto-publish function for the save/publish widget, or for SimpleTable saveFn
 * Must provide type and id, or path
 * path is only used to fill in for missing item info
 * * @param {type, id, item, path}
 */
const autoPublishFn = _.debounce(({type, id, path, item}) => {
	if (!type || !id) {
		item = item || DataStore.getValue(path);
		id = id || getId(item);
		type = type || getType(item);
	}
	assert(C.TYPES.has(type), `Misc.jsx publishDraftFn bad/missing type: ${type} id: ${id}`);
	assMatch(id, String, `Misc.jsx publishDraftFn id?! ${type} id: ${id}`);
	// still wanted?
	const localEditStatus = DataStore.getLocalEditsStatus(type, id);
	const status = getStatus(item);
	const isdirty = C.STATUS.isdirty(localEditStatus) || C.STATUS.issaveerror(localEditStatus);
	const isSaving = C.STATUS.issaving(localEditStatus);
	if (status === C.KStatus.PUBLISHED && !isdirty) {
		return;
	}
	// Do it
	publish({type, id, item});
	return true;
}, DEBOUNCE_MSECS);


/**
 * no-op 
 * @returns {boolean} true
 */
const T = () => true;


/**
 * Just console log if ! ok.
 * @param {Boolean} ok 
 * @returns {Boolean}
 */
const check = ok => {
	if (ok) return true;
	if (ok === false) return false;
	// bad output
	if (!ok) {
		console.error('pre-X should return true|false -- NOT falsy. Treating as OK and proceeding.');
	}
	return true;
};


/** Currently unused - describes state of item versions in DataStore */
/*
const getDSI = (pubv, draftv) => {
	if (!pubv) return draftv ? 'draft only' : 'nothing loaded';
	if (draftv === pubv) return 'published = draft';
	if (draftv) return 'published & draft';
	return 'published only';
};
*/


/**
 * save buttons
 * @param {Object} p
 * @param {!string} p.type Must be in C.TYPES
 * @param {!string} p.id
 * @param {?String} p.className Defaults to "SavePublishDeleteEtc" (which activates the black fixed-position design). Set to e.g. "" avoid that design.
 * @param {?Boolean} p.hidden If set, hide the control (it will still auto-save)
 * @param {?Boolean} p.autoSave default=true
 * @param {?Boolean} p.autoPublish default=false NB: If autoPublish is set then autoSave is moot
 * @param {?Boolean|Function} p.saveAs If set, offer a save-as button which will copy, tweak the ID and the name, then save.
 * 	If this is a function, it is invoked with the new-item. By default, a "switch the ID in the url" function will be invoked.
 * @param {?String} p.navpage Used to redirect after a delete
 * @param {?String} p.size Bootstrap size e.g. "lg"
 * @param {?string} p.position fixed|relative
 * @param {?Boolean} p.sendDiff Send a JSON Patch instead of a complete object, making field deletions etc compatible with ElasticSearch partial doc overwrites.
 * @param {?Boolean} p.oneButton render as a single button instead of a large footer bar (useful for embedding in smaller controls)
 * @param {?Array[]} p.targetPaths a list of paths to props in the item to target for saving - ignores any other changes. used with oneButton
 * @param {?Boolean} p.noPublish If not need publish button
 * A snapshot is taken the first time this renders.
 */
function SavePublishDeleteEtc({
	type, id,
	hidden, position, className = "SavePublishDeleteEtc",
	size,
	cannotPublish, cannotDelete, canArchive, canDiscard,
	publishTooltipText = 'Your account cannot publish this.',
	autoPublish, 
	autoSave = true,
	navpage,	
	saveAs, unpublish,
	prePublish = T, preDelete = ({item, action}) => confirmUserAction({item, action}), preArchive = T, preSaveAs = T,
	sendDiff,
	oneButton, targetPaths,
	noPublish,
	noSave
}) {
	// No anon edits
	if ( ! Login.isLoggedIn()) {
		if (hidden) return null;
		return <div className="SavePublishDeleteEtc"><i>Login to save or publish edits</i></div>;
	}

	assert(C.TYPES.has(type), 'SavePublishDeleteEtc - not a type: ' + type);
	assMatch(id, String);

	let localStatus = DataStore.getLocalEditsStatus(type, id) || C.STATUS.clean;
	const isdirty = C.STATUS.isdirty(localStatus) || C.STATUS.issaveerror(localStatus);
	let isSaving = C.STATUS.issaving(localStatus);
	const status = C.KStatus.DRAFT; // editors always work on drafts
	let item = DataStore.getData({ status, type, id });
	// Keep a copy of the draft in case we mess with it later (e.g. targetPaths)
	let draftItem = _.cloneDeep(item);

	// If we use target paths, our localStatus will not match what DataStore thinks - track it ourselves
	const [targetPropsChanged, setTargetPropsChanged] = useState(false);

	// If target paths is set, diffs must be used
	if (targetPaths) {
		assert(_.isArray(targetPaths), 'targetPaths not array??');
		sendDiff = true;
	}

	// debug info on DataStore state
	let pubv = DataStore.getData({ status: C.KStatus.PUBLISHED, type, id });
	/* // Description (& therefore draftv also) currently unused
	let draftv = DataStore.getData({ status: C.KStatus.DRAFT, type, id });
	const dsi = getDSI(pubv, draftv);
	*/
	// Does a published version exist? (for if we show unpublish)
	// NB: item.status = MODIFIED should be reliable but lets not entirely count on it.
	const pubExists = pubv || (item && item.status !== C.KStatus.DRAFT);

	// If targetPaths is true, use the published item as a clean comparison object
	let previous = targetPaths ? pubv : null;

	const prevPath = ['widget', 'SavePublishDeleteEtc', type, id];
	if (!previous) previous = DataStore.getValue(prevPath);
	useEffect(() => {
		if (item && !isdirty) {
			// console.log("set previous")
			DataStore.setValue(prevPath, _.cloneDeep(item));
		}
	}, [item, isdirty]);

	// Restrict item changes to targeted paths
	if (targetPaths && targetPaths.length && item && pubv) {
		if (!_.isArray(targetPaths[0])) targetPaths = [[targetPaths[0]]]
		let restrictedItem = _.cloneDeep(pubv);
		targetPaths.forEach(targetPath => {
			const draftVal = getObjectValueByPath(item, targetPath);
			setObjectValueByPath(restrictedItem, targetPath, draftVal);
		});
		item = restrictedItem;
	}

	// request a save/publish?
	if (isdirty && !isSaving) {
		if (autoPublish) {
			// Use last published item as previous for comparison
			autoPublishFn({ type, id, item, previous });
		} else if (autoSave) {
			const saveDraftFn = saveDraftFnFactory({ type, key: id });
			// Make sure we save the full draft - not just the restricted item targetPaths creates
			saveDraftFn({ type, id, item, previous, swallow: true }); // auto-save hides errors TODO show a warning icon on the widget
		}
	}

	// Sometimes we just want to autosave drafts!
	if (hidden) return <span style={{position: 'absolute'}} />;

	// if nothing has been edited, then we can't publish, save, or discard
	// ??this no longer works as we force the item to be pulled from "DRAFT"
	// will therefore never have status of "PUBLISHED" <- what about an unmodified published item??
	// (Dan: tested June 2023 -- seems to work as expected)
	let noEdits = item && C.KStatus.isPUBLISHED(item.status) && C.STATUS.isclean(localStatus) && !targetPropsChanged;

	let disablePublish = isSaving || noEdits || cannotPublish || (oneButton && !pubExists);
	let publishTooltip = cannotPublish ? publishTooltipText : (noEdits ? 'Nothing to publish' : 'Publish your edits!');
	let disableDelete = isSaving || cannotDelete;

	const vis = { visibility: (isSaving ? 'visible' : 'hidden') };

	let pubLabel = !isSaving ? `Publish ${pubExists ? ' Edits' : ''}` : 'Saving...';
	if (oneButton) {
		if (!pubExists) pubLabel = 'Not Published!';
		else if (noEdits) pubLabel = 'No changes!';
	}

	const PublishButton = () => <Button name="publish" color="primary" size={size} className="ml-2"
		disabled={disablePublish} title={publishTooltip}
		onClick={() => check(prePublish({ item, action: C.CRUDACTION.publish })) && publish({type, id, item, previous})}
	>
		{pubLabel} {oneButton && !pubExists && <Help color="white">For safety, you can only publish a new item from it's own editor page</Help>} <Spinner vis={vis} />
	</Button>;

	if (oneButton) return <PublishButton/>;

	// merge discard / unpublish / delete into one button with a dropdown of options??
	// merge save / saveAs into one button with a dropdown of options?

	/**
	 * Inform user delete action was succesful, and redirect to home preserving search params.
	 */
	const doDeleteAndRedirect = () => {
		let ok = check(preDelete({ item, action: C.CRUDACTION.delete }));
		if (!ok) return;
		const pDel = ActionMan.delete(type, id);
		pDel.promise.then(() => Messaging.notifyUser(`${type} ${id} deleted`));
		// redirect back up a level, preserving any params eg filtering already present
		if (navpage) {
			modifyPage(navpage.split('/'));
			return;
		}
		const currentUrl = new URL(window.location);
		// HACK: remove id from hash
		let href;
		if (DataStore.localUrl === '#') {
			let i = currentUrl.hash.lastIndexOf('/');
			href = currentUrl.hash.substring(1, i);
		} else {
			let i = currentUrl.search.lastIndexOf('/');
			href = currentUrl.search.substring(0, i);
		}
		modifyPage(href.split('/'));
	};

	const SaveEditsButton = () => (
		<Button name="save" size={size}
			color={C.STATUS.issaveerror(localStatus) ? 'danger' : 'secondary'}
			title={C.STATUS.issaveerror(localStatus) ? 'There was an error when saving' : null}
			disabled={isSaving || C.STATUS.isclean(localStatus)}
			onClick={() => saveEdits({ type, id, item, previous })}
		>
			Save Edits <Spinner vis={vis} />
		</Button>
	);

	// toggle state for accessing Save As
	const [isSaveButtonDropdownOpen, setSaveButtonDropdownOpen] = useState();

	const doSaveAs = e => {
		let ok = check(preSaveAs({ item, action: C.CRUDACTION.copy }));
		if (!ok) return;
		let onChange;
		if (isFunction(saveAs)) {
			onChange = saveAs;
		} else {
			// switch location to the new ID
			onChange = (newItem) => {
				if (!getId(item) || !getId(newItem)) return; // paranoia
				const locn = String(window.location);
				let newLocn = locn.replace(getId(item), getId(newItem));
				if (newLocn == locn) return;
				goto(newLocn);
				notifyUser(`Switched editor to new version: ${getName(newItem) || getId(newItem)}`);
			};
		}
		ActionMan.saveAs({ type, id, onChange});
		setSaveButtonDropdownOpen(false);
	};

	return (
		<div className={className} style={{ position }} title={item && item.status}>

			{!saveAs && !noSave && <SaveEditsButton />}

			{saveAs &&
				<ButtonDropdown size={size} isOpen={isSaveButtonDropdownOpen} toggle={() => setSaveButtonDropdownOpen( ! isSaveButtonDropdownOpen)}>
					<SaveEditsButton />
					<DropdownToggle split size={size} color="secondary" />
					<DropdownMenu>
						<Button name="save-as" color="secondary" size={size}
							disabled={isSaving}
							title="Copy and save with a new ID"
							onClick={doSaveAs} >
							<Icon name="copy" /> Copy (save as new) <Spinner vis={vis} />
						</Button>
					</DropdownMenu>
				</ButtonDropdown>
			}

			{!noPublish && <PublishButton/>}

			{unpublish &&
				<Button name="unpublish" color="outline-warning" size={size} className="ml-2"
					disabled={isSaving || !pubExists}
					title="Move from published to draft"
					onClick={() => ActionMan.unpublish(type, id)} >
					Un-Publish <Spinner vis={vis} />
				</Button>
			}

			{canDiscard && <Button name="discard" color="outline-warning" size={size} className="ml-2"
				disabled={isSaving || noEdits}
				onClick={() => ActionMan.discardEdits(type, id)}>
				Discard Edits <Spinner vis={vis} />
			</Button>}

			{canArchive &&
				<Button size={size} className="ml-2" name="archive" color="outline-warning" disabled={isSaving || noEdits}
					title="Archive"
					onClick={() => check(preArchive({ item, action: 'archive' })) && ActionMan.archive({ type, id })} >
					Archive <Spinner vis={vis} />
				</Button>
			}

			{!cannotDelete &&
				<Button size={size} className="ml-2" title="Delete!" name="delete" color="outline-danger" disabled={disableDelete}
					onClick={doDeleteAndRedirect} >
					<Icon name="trashcan" /> <Spinner vis={vis} />
				</Button>
			}
			{/* <div><small>Status: {item && item.status} | Unsaved changes: {localStatus}{isSaving ? ', saving...' : null} | DataStore: {dsi}</small></div> */}
		</div>
	);
}


function Spinner({ vis }) {
	return <span className="fa fa-circle-notch spinning" style={vis} />
}


// backwards compatibility
Misc.SavePublishDiscard = SavePublishDeleteEtc;
Misc.publishDraftFn = autoPublishFn;


export default SavePublishDeleteEtc;
export {
	confirmUserAction,
	autoPublishFn as publishDraftFn,
	saveDraftFnFactory
};
