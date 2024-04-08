import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { space } from '../utils/miscutils';

import { UploadProgress } from './propcontrols/PropControlUpload';

/**
 * An upload widget that doesn't act as a URL input, it just sends the file to the endpoint and executes any provided callback.
 */
function BlindUpload({endpoint, uploadParams, onUpload, label, className, onDrop: _onDrop, ...props}) {
	const [uploading, setUploading] = useState(false);

	// When file picked/dropped, upload to the media cluster
	const onDrop = (accepted, rejected) => {
		// Update progress readout - use updater function to merge start time into new object
		const progress = ({ loaded, total }) => setUploading(({start}) => ({ start, loaded, total }));
		// Upload complete = delete progress readout
		const load = () => setUploading(false);

		accepted.forEach(file => {
			const uploadOptions = {};
			if (uploadParams) uploadOptions.params = uploadParams;
			if (endpoint) uploadOptions.endpoint = endpoint;

			ServerIO.upload(file, progress, load, uploadOptions)
				.done(response => onUpload && onUpload(response))
				.fail(res => res.status == 413 && notifyUser(new Error(res.statusText)));
				// Record start time of current upload
				setUploading({start: new Date().getTime()});
		});
		// TODO Inform the user that their file had a Problem
		rejected.forEach(file => console.error("rejected :( " + file));
		_onDrop && _onDrop();
	};

	// New hooks-based DropZone - give it your upload specs & an upload-accepting function, receive props-generating functions
	const { getRootProps, getInputProps } = useDropzone({accept: null, onDrop, disabled: false});

	return (
		<div className={space('DropZone', className)} {...props} {...getRootProps()} >
			<input {...getInputProps()} />
			<small>{label}</small>
			{uploading ? <UploadProgress {...uploading} /> : null}
		</div>
	);
};

export default BlindUpload;