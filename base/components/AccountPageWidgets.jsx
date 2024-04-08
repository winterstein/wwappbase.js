import React, { useState } from 'react';

import Login from '../youagain';
import C from '../CBase';
import DataStore from '../plumbing/DataStore';
import ServerIO from '../plumbing/ServerIOBase';
import Roles from '../Roles';
import Misc from './Misc';
// HACKS
import CardAccordion from './CardAccordion'; // Hack: this is here to poke CardAccordion into Misc for older code
import PropControl from './PropControl'; // Hack: this is here to poke Input into Misc for older code
import XId from '../data/XId';
import { LoginLink } from './LoginWidget';
import { setTaskTags } from './TaskList';
import AboutPage from './AboutPage';
import { Button, Card } from 'reactstrap';
import ShareWidget, { ShareLink } from './ShareWidget';

const BasicAccountPage = () => {
	if (!Login.isLoggedIn()) {
		return (
			<div>
				<h1>My Account: Please login</h1>
				<LoginLink title='Login' />
			</div>
		);
	}

	setTaskTags();
	return (
		<div className=''>
			<h1>My Account</h1>
			<LoginCard />
			<RolesCard />
			<StatusCard />

			{/* minor todo <Card>
				<AboutPage />
			</Card> */}
		</div>
	);
};

const LoginCard = () => {
	return (
		<Misc.Card title='Login'>
			ID: {Login.getId()} <br />
		</Misc.Card>
	);
};

const RolesCard = () => {
	let proles = Roles.getRoles();
	let roles = proles.value;

	return (
		<Misc.Card title='Roles'>
			<p>Roles determine what you can do. E.g. only editors can publish changes.</p>
			{roles ? roles.map((role, i) => <RoleLine key={i + role} role={role} />) : <Misc.Loading />}
			{roles && roles.includes('admin') && C.ROLES && (
				<div>
					<hr />
					{C.ROLES.values.map((role, i) => (
						<RoleLine key={'admin' + i + role} role={role} />
					))}
				</div>
			)}
		</Misc.Card>
	);
};

const RoleLine = ({ role }) => {
	return (
		<div className='badge badge-pill badge-info'>
			{role}
			{(Roles.isDev() || Roles.iCan('admin')) && <ShareWidget shareId={'role:' + role} hasButton />}
		</div>
	);
};

const StatusCard = () => {
	/**
	 * @param {boolean} emailSent
	 */
	const [emailSent, setEmailSent] = useState(false);

	const doSendVerifyEmail = (e) => {
		e.preventDefault();
		let email = Login.getEmail();
		assMatch(email, String);
		let call = Login.sendVerify(email)
			.then((res) => {
				console.log(res);
				if (res.success) setEmailSent(true);
			})
			.catch((err) => {
				console.log(err);
			});
	};

	const status = Login.getStatus();

	return (
		<Misc.Card title='Verification (Testing)'>
			<div className='d-flex justify-content-between'>
				<span>Verification Status: {status ? status : 'Loading...'}</span>
				{!emailSent ? (
					<Button disabled={status === 'VERIFIED'} onClick={doSendVerifyEmail}>
						doSendVerifyEmail
					</Button>
				) : (
					<Button disabled={true}>Email Sent</Button>
				)}
			</div>
		</Misc.Card>
	);
};

export { BasicAccountPage, RolesCard, LoginCard, StatusCard };
