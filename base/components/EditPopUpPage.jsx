import React, { useEffect, useState } from 'react';
import { Alert } from 'reactstrap';

import PropControl from './PropControl';
import DataStore from '../plumbing/DataStore'
import { setWindowTitle } from '../plumbing/Crud';

/** Props for the PropControl which don't depend on the invoking component */
const staticProps = {
	path: ['widget', 'EditPopup'],
	prop: 'value',
	style: { width: '100%', height: '100vh' },
};
const dsPath = staticProps.path.concat(staticProps.prop);


/**
 * Minimal page for a pop-up window containing a PropControl linked back to the main window - see PropControl_PopUp.jsx
 */
function EditPopUpPage() {
	const [ready, setReady] = useState(false); // Don't enable the control until it's been initialised by the creating window
	// Read props for the PropControl from URL params & pull out stuff we don't want rendering
	const { source, label, modal, popup, help, ...extraProps } = DataStore.getValue(['location', 'params']);

	if (!window.opener) return <Alert color="danger">Something went wrong. Try re-opening this window.</Alert>;

	useEffect(() => {
		setWindowTitle(`${label}: Popout Editor`);

		const receiveMessage = msg => {
			if (msg.origin !== window.location.origin) return; // Only accept messages from the same site as the component
			if (msg.data.source !== source) return; // Only accept messages from the matching editor
			DataStore.setValue(dsPath, msg.data.value);
			if (!ready) setReady(true);
		};
		window.addEventListener('message', receiveMessage);

		// Inform the creating window this page is ready
		// ...after a delay to make sure the creating component has time to complete an update cycle & set up listeners
		window.setTimeout(() => window.opener.postMessage({ source, ready: true }), 100);

		// Inform the creating window when this tab closes
		const sendClosed = () => window.opener.postMessage({ source, closed: true });
		window.addEventListener('beforeunload', sendClosed);

		// Cleanup (probably unnecessary since this shouldn't unmount as long as the page is loaded, but.)
		return () => {
			window.removeEventListener('message', receiveMessage);
			window.removeEventListener('beforeunload', sendClosed);
		};
	}, []);

	const sendVal = ({value}) => window.opener.postMessage({source, value});

	return <PropControl {...staticProps} saveFn={sendVal} disabled={!ready} {...extraProps} />;
}

export default EditPopUpPage;
