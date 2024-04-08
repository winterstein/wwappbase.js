import React, { useState } from 'react';
import { assert, assMatch } from '../utils/assert';
import Login from '../youagain';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'reactstrap';
import {copyTextToClipboard, setUrlParameter, isEmail, stopEvent, uid, space } from '../utils/miscutils';
import DataStore from '../plumbing/DataStore';
import Misc from './Misc';
import C from '../CBase';
import DataClass, {getType, getId, getClass} from '../data/DataClass';
import XId from '../data/XId';
import Roles, {getRoles} from '../Roles';
import Shares, {Share, canRead, canWrite, shareThingId, doShareThing, getShareListPV} from '../Shares';
import PropControl from './PropControl';
import Icon from './Icon';
import JSend from '../data/JSend';


/**
 * a Share This button
 */
function ShareLink({className, style, item, type, id, shareId, children, color = 'secondary', ...props}) {
	if (!shareId) {
		if (item) {
			type = getType(item);
			id = getId(item);
		}
		if (!type || !id) return null;
		shareId = shareThingId(type, id);
	}

	const doShow = e => {
		stopEvent(e);
		DataStore.setValue(['widget', 'ShareWidget', shareId, 'show'], true);
	};

	return <Button className={space('share-widget-btn', className)} color={color} onClick={doShow} title="Share" {...props}>
		<Icon name="share" />
		{children && ' '}{children}
	</Button>;
}


/**
 *
 * @param {!String} shareId - From shareThingId()
 */
const shareThing = ({shareId, withXId}) => {
	assMatch(shareId, String);
	Shares.doShareThing({shareId, withXId});
	// clear the form
	DataStore.setValue(['widget', 'ShareWidget', 'add'], {});
};


/**
 * Delete share after confirming
 */
const deleteShare = ({share}) => {
	if (!confirm('Remove access: Are you sure?')) return;

	// Confirmed, call the server
	const thingId = share.item;
	assMatch(thingId, String);
	Shares.doDeleteShare(share);
};


/**
 * A dialog for adding and managing shares
 *
 * @param {Object} p
 * @param {?String} p.shareId E.g. "role:editor" Set this, or item, or type+id.
 * @param {?DataClass} p.item - The item to be shared
 * @param {?String}	p.name - optional name for the thing
 * @param {?boolean} p.hasButton - Show the standard share button? Otherwise this would NOT include the share button -- see ShareLink for handling that separately.
 * @param {?boolean} p.hasLink offer a share-by-link option
 * @param {?String}	p.email - optional, auto-populate the email field with this value
 *
 */
function ShareWidget({shareId, item, type, id, name, email, hasButton, hasLink, noEmails, ...props}) {
	if (!shareId) {
		if (item) {
			type = getType(item);
			id = getId(item);
			name = (getClass(type) && getClass(type).getName(item)) || DataClass.getName(item);
		}
		if (!type || !id) return null;

		shareId = shareThingId(type, id);
	}

	const basePath = ['widget', 'ShareWidget', shareId];
	const data = DataStore.getValue(basePath) || DataStore.setValue(basePath, {form: {}}, false);
	const {warning, show, form} = data;
	const formPath = basePath.concat('form');
	if (!name) name = shareId;
	let title = `Share ${name}`;
	let {email: withXId, enableNotification} = form;
	if (withXId) withXId += '@email';
	let shares = show && Shares.getShareListPV(shareId).value;
	let emailOK = isEmail(DataStore.getValue(formPath.concat('email')));
	// TODO share by url on/off
	// TODO share message email for new sharers

	const toggle = () => {
		DataStore.setValue([...basePath, 'show'], !show)
	};

	const doShare = () => {
		const {form} = DataStore.getValue(basePath) || {};
		shareThing({shareId, withXId});
	};

	return <>
		{hasButton && <ShareLink shareId={shareId} {...props} />}
		<Modal isOpen={show} className="share-modal" toggle={toggle}>
			<ModalHeader toggle={toggle}>
				<Icon name="share" /> {title}
			</ModalHeader>
			<ModalBody>
				{!noEmails && <>
					<div className="clearfix">
						<p>Grant another user access to this item</p>
						<PropControl inline label="Email to share with" path={formPath} prop="email" type="email" dflt={email || ""} />
						<Button color="primary" disabled={!emailOK} onClick={doShare}>Share</Button>
						{/* TODO <PropControl path={formPath} prop="enableNotification" label="Send a notification email" type="checkbox"/> */}
						{enableNotification ? (
							<PropControl path={formPath} prop="optionalMessage" id="OptionalMessage" label="Attached message" type="textarea" />
						) : null}
					</div>
					<h5>Shared with</h5>
					<ListShares list={shares} />
				</>}
				{hasLink && <ShareByLink name={name} shareId={shareId} />}
			</ModalBody>
		</Modal>
	</>;
} // ./ShareWidget


/**
 * NB: Use an async function for nicer code around the server comms
 * @param {Object} p See ShareWidget which calls this
 * @returns 
 */
const doShareByLink = async ({link, slink, setSlink, shareId, name}) => {
	// Share link already generated? Just use it.
	if (slink) {
		copyTextToClipboard(slink);
		return;
	}

	// Construct a username for the pseudo-user - specific to shared resource & creating user.
	// TODO allow one pseudo-user for the item across users, via:shareId+"@share"});
	const withXId = `${shareId}_by_${Login.getId()}@pseudo`;

	// If-when we know a pseudo-user exists:
	// - get their JWT, construct a share link, save it to slink for re-use, and copy to clipboard.
	const getJWTForPseudo = async (pseudoShare) => {
		try {
			console.log(`ShareByLink: Fetching JWT for pseudo-user "${withXId}"`);
			// Get the jwt for the existing pseudo-user
			const jwtres = await Login.getJWT({txid:withXId});
			const jwt = JSend.data(jwtres);
			await doShareThing({shareId, withXId});
			const link2 = setUrlParameter(link, 'jwt', jwt);
			copyTextToClipboard(link2);
			setSlink(link2);
			return true;
		} catch(err) {
			if (pseudoShare) console.warn(`ShareByLink: Can't use existing pseudoShare ${pseudoShare} for ${withXId}`);
			console.warn(err);
		}
		return false;
	}

	// Is there already a pseudo-user owned by the logged-in user which has the resource shared to it?
	const shares = await getShareListPV(shareId).promise;
	const pseudoShare = shares.find(s => s._to === withXId);
	if (pseudoShare) {
		console.log(`ShareByLink: Pseudo-user ${withXId} appears to exist, fetching JWT...`);
		if (getJWTForPseudo(pseudoShare)) return;
		// If this fails, push ahead and try creating the pseudouser
	}

	// No pseudo-user for this resource, so register a new one.
	console.log('ShareByLink: Registering new pseudo-user...');
	try {
		// Block until pseudo-user exists...
		await Login.registerStranger({name: `Pseudo-user for "${name}"`, person: withXId});
		// NB DO NOT use response.cargo.user from the registerStranger call: this is the logged-in user object, not the new pseudo-user!
	} catch (err) {
		// Error recovery: it's OK if this user already exists.
		if (!err.responseText.match(/already registered/i)) throw err;
	}

	// Claim ownership of the new pseudo-user - blocking so we don't try to generate JWT until we have it.
	await Login.claim(withXId);

	// Pseudo-user is all set up - now fetch their JWT and generate share link.
	getJWTForPseudo();

	// ?? share the pseudo-user with the shareId (modified to be an XId) (so TODO e.g. users of a dashbaord can access the pseudo-user)
	// doShareThing({shareId:withXId, withXId:shareId+"@share"});
}; // ./ doShareByLink


function ShareByLink({ link = window.location.href, name, shareId }) {
	let [slink, setSlink] = useState();

	return <><h5>General Access</h5>
		<Button onClick={e => doShareByLink({link, slink, setSlink, shareId, name})} id="copy-share-widget-link">
			<Icon name="copy" /> Copy access link
		</Button>
	</>;
}


/**
 * 
 * @param {Object} p
 * @param {Share[]} p.list
 * @returns 
 */
function ListShares({list}) {
	if (!list) return <Misc.Loading text="Loading current shares" />;
	// dont show pseudo users
	if (!Roles.isDev()) {
		list = list.filter(s => s._to && XId.service(s._to) !== 'pseudo');
	}
	return (
		<ul className="ListShares">
			{list.length ? (
				list.map(s => <SharedWithRow key={JSON.stringify(s)} share={s} />)
			) : 'Not shared.'}
		</ul>
	);
}


function SharedWithRow({share}) {
	assert(share, 'SharedWithRow');
	return (
		<li className="clearfix">
				{share._to}
				<Button color="danger" className="pull-right"
					title={`Revoke access for ${share._to}`}
					onClick={() => deleteShare({share})} 
				>🗙</Button>
		</li>
	);
}


function AccessDenied({thingId}) {
	if (!getRoles().resolved) return <Misc.Loading text="Checking roles and access..." />;

	return (
		<Misc.Card title="Access Denied :(">
			<div>Sorry - you don't have access to this content.
				{thingId? <div><code>Content id: {thingId}</code></div> : null}
				<div>Your id: <code>{Login.isLoggedIn()? Login.getId() : "not logged in"}</code></div>
				<div>Your roles: <code>{getRoles().value? getRoles().value.join(", ") : "no roles"}</code></div>
			</div>
		</Misc.Card>
	);
}


/**
 *
 * @param {String} id - The app item ID.
 */
function ClaimButton({type, id}) {
	const sid = shareThingId(type, id);
	const plist = Shares.getShareListPV(sid);
	if (!plist.resolved) {
		return <Misc.Loading text="Loading access details" />;
	}
	if (plist.value.length !== 0) {
		return <div>Access is held by: {plist.value.map( v => v._to + '\n')}</div>;
	}

	return <div>
		This {type} has not been claimed yet. If you are the owner or manager, please claim it.
		<div>
			<Button color="secondary" onClick={() => Shares.claimItem({type, id})}>email
				Claim {id}
			</Button>
		</div>
	</div>;
}


export default ShareWidget;
export {ShareLink, ShareWidget, AccessDenied, ClaimButton, canRead, canWrite, shareThingId};
