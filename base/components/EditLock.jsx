import React, { useState, useEffect } from 'react';
import { Button, Card, CardHeader, CardBody, Modal, ModalBody } from 'reactstrap';
import C from '../../C';
import Login from '../youagain';
import { useLongPoll } from '../plumbing/LongPoll';
import DataStore from '../plumbing/DataStore';

import '../style/EditLock.less';

/**
 * Usage as originally written: in your project's MainDiv.jsx, pass this function to MainDivBase as param "Persistent".
 */
const EditLock = ({page}) => {
	const [details, setDetails] = useState([]);
	const [users, setUsers] = useState({users:[], pendingUsers:[]});
	const [listURL, setListURL] = useState(null);

	const xid = Login.getUser()?.xid;
	const locked = users.users.includes(xid);
	const occupied = !locked && users.users.length > 0;
	const requested = users.pendingUsers.includes(xid);

	const path = DataStore.getValue(['location', 'path']);
	
	//"/editlock/list/draft/"+type+"/"+id+"?current="+encodeURIComponent(JSON.stringify(users))
	useEffect(() => {
		resetUsers();
		if (C.TYPES.values.map(v => v.toLowerCase()).includes(page)) {
			const type = page;
			const id = path[1];
			if (type && id) {
				setDetails([type, id]);
				setListURL(`/editlock/list/draft/${type}/${id}?data=${encodeURIComponent(JSON.stringify({users:[], pendingUsers:[]}))}`);
			} else {
				setDetails([]);
				setListURL(null);
				release();
			}
		} else {
			setDetails([]);
			setListURL(null);
			release();
		}
	}, [page, path]);

	useLongPoll(({data}) => {
		setUsers(data);
		if (details.length) {
			setListURL(`/editlock/list/draft/${details[0]}/${details[1]}?data=${encodeURIComponent(JSON.stringify(data))}`);
		}
	}, listURL, 5000);

	const getLock = () => {
		fetch(`/editlock/lock/draft/${details.join('/')}`);
	};

	const release = () => {
		if (locked && details.length) {
			fetch(`/editlock/release/draft/${details.join('/')}`);
		}
	};

	const resetUsers = () => {
		setUsers({users:[], pendingUsers:[]});
	};

	// release on close
	useEffect(() => {
		return release;
	}, []);

	let btnText = 'Edit';
	if (occupied) btnText = 'Request access';
	else if (requested) btnText = 'Requested';

	return <>
		<Card className="edit-lock">
			<CardHeader>
				<h5>Other editors online</h5>
			</CardHeader>
			<CardBody>
				{users.users.map(user => <p>{user}</p>)}
				<Button onClick={getLock} color="primary" disabled={requested}>{btnText}</Button>
			</CardBody>
		</Card>
		<Modal isOpen={users.pendingUsers.length > 0}>
			<ModalBody>
				<p>
					The following users are requesting edit access:
					{users.pendingUsers.map(user => <span>{user}</span>)}
				</p>
				<Button color="primary">Accept</Button><Button color="danger">Reject</Button>
			</ModalBody>
		</Modal>
	</>;
};

export default EditLock;
