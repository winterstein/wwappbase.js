
/*
 * This sends files to uploads.good-loop.com
 *	Which returns a MediaObject-like json -- including the url, which is then put into the property

 It can also connect to UploadServlet endpoints, if you set one up.
 */

import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button, FormGroup, Label } from 'reactstrap';

import PropControl, { fakeEvent, FormControl, registerControl, setInputStatus } from '../PropControl';
import Misc from '../Misc';
import { urlValidator } from './validators';
import Icon from '../Icon';
import LinkOut from '../LinkOut';
import { bytes, space } from '../../utils/miscutils';
import { notifyUser } from '../../plumbing/Messaging';
import ServerIO from '../../plumbing/ServerIOBase';


/** MIME type sets */
const imgTypes = '.jpg, .jpeg, image/jpeg, .png, image/png, .svg, image/svg+xml';
const videoTypes = '.mp4, .m4v, video/mp4, .ogv, video/ogg, .avi, video/x-msvideo, .wmv, video/x-ms-wmv, .mov, video/quicktime, .asf, video/ms-asf';
const fontTypes = '.ttf, font/ttf, .otf, font/otf, .woff, font/woff, .woff2, font/woff2';
const spreadsheetTypes = '.csv'; // TODO Excel and -- maybe using libreoffice as the backend convertor to csv? Or the Apache Something library?


/** Uploader types which take a 100x100 square thumbnail */
const typesWithThumbnail = { imgUpload: true, videoUpload: true, bothUpload: true };
/** Style block for a 100x100 square thumbnail */
const thumbnailStyle = { width: '100px', height: '100px', position: 'relative' };


/** Accepted MIME types for input types*/
const acceptTypes = {
	imgUpload: imgTypes,
	videoUpload: videoTypes,
	bothUpload: `${imgTypes}, ${videoTypes}`,
	fontUpload: fontTypes,
	spreadsheetUpload: spreadsheetTypes,
};


/** Human-readable descriptions of accepted types */
const acceptDescs = {
	imgUpload: 'JPG, PNG, or SVG image',
	videoUpload: 'video',
	bothUpload: 'video or image',
	fontUpload: 'font',
	upload: 'file',
	spreadsheetUpload: '.csv',
	// emailUpload: '.eml' ??
};

/**
 * Warts are processed within AdUnit -- ccrop is done by local css, whilst noscale switches off the use of media.gl.com's scaling
 * 
 * @param {!String} rawUrl
 * @param {Regex} wartMatcher e.g. /ccrop:\d+/ 
 * @param newWart e.g. ccrop:90
 * @returns url with/without newWart
 */
const hashWart = (rawUrl, wartMatcher, newWart) => {
	const url = new URL(rawUrl);
	// Turn "#wart1_wart2" into ["wart1", "wart2"]
	let hashBits = url.hash.replace(/^#/, '').split('_');
	// Replace existing or append new wart
	let replaced = false;
	hashBits = hashBits.map(bit => {
		if (bit.match(wartMatcher)) {
			replaced = true;
			return newWart;
		}
		return bit;
	}).filter(a => !!a);
	if (!replaced) hashBits.push(newWart);
	url.hash = hashBits.join('_');

	let newUrl = url.toString().replace(/#$/, ''); // Render URL and strip empty hash or trailing underscore

	return newUrl;
}


/**
 * Print size of file in progress, percent done, estimated time remaining.
 * @param {Number} start UTC timestamp of upload start (msec)
 * @param {Number} loaded Bytes sent so far
 * @param {Number} total Total size of file in bytes
 */
export const UploadProgress = ({ start, loaded = 0, total }) => {
	if (!start) return null;
	if (!total) return 'Starting upload...';

	const elapsed = new Date().getTime() - start;
	const fraction = loaded / total;
	const until = (elapsed / fraction) - elapsed;

	return <div>
		Size: {bytes(total)}<br/>
		{Math.floor(fraction * 100)}% done<br/>
		{Math.ceil(until / 1000)}s remaining
	</div>;
};


/** CSS for the circle overlaid on the thumbnail while editing circle-crop to show its effect */
/* Margin rule is to match the default on the Bootstrap img-thumbnail property */
const circleStyle = { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', borderRadius: '50%', border: '1px dashed silver', overflow: 'visible', zIndex: '1', margin: '5px'};


/** Wrap the LinkOut component to rename its "href" prop so it can be used in place of a Thumbnail component */
const LinkThumbnail = ({url}) => <LinkOut href={url}>{url}</LinkOut>;


/** Display a sampler of the uploaded font, if present */
const FontThumbnail = ({url}) => {
	if (!url) return null;
	return <>
		<style>{`@font-face { font-family: "Font-Upload-Test"; src: url("${url}") format("woff"); }`}</style>
		<p className="my-1" style={{fontFamily: 'Font-Upload-Test'}} contentEditable suppressContentEditableWarning>
			The quick brown fox jumps over the lazy dog.
		</p>
	</>;
};


/**
 * image or video upload. Uses Dropzone
 * @param {Object} p
 * @param {Boolean} p.collapse ??
 * @param {?String} p.endpoint
 * @param {(file: File) => Promise<boolean>} p.onFileSelect Called before uploading, should return a boolean.
 * @param {Function} onUpload {path, prop, url, response: the full server response} Called after the server has accepted the upload.
 * @param {?string} version mobile|raw|standard -- defaults to raw
 * @param {?Boolean} cacheControls Show "don't use mediacache to resize, always load full-size" hash-wart checkbox
 * @param {?Boolean} circleCrop Show "crop to X% when displayed in a circle" hash-wart control
 */
const PropControlUpload2 = ({ path, prop, onUpload, type, bg, storeValue, value, set, onChange, collapse, size, 
	version="raw", cacheControls, circleCrop, endpoint, uploadParams, onFileSelect, noUrl, ...otherStuff }) => 
{
	delete otherStuff.https;

	const [collapsed, setCollapsed] = useState(true);
	const isOpen = ! collapse || ! collapsed;
	const [previewCrop, setPreviewCrop] = useState(false); // Draw a circle around the image to preview the effect of circle-crop

	const [uploading, setUploading] = useState(false);

	// Automatically decide appropriate thumbnail component
	const Thumbnail = {
		imgUpload: Misc.ImgThumbnail,
		videoUpload: Misc.VideoThumbnail,
		bothUpload: storeValue.match(/(png|jpe?g|svg)$/) ? Misc.ImgThumbnail : Misc.VideoThumbnail,
		fontUpload: FontThumbnail,
		upload: LinkThumbnail
	}[type];

	// When file picked/dropped, upload to the media cluster
	const onDrop = (accepted, rejected) => {

		// Update progress readout - use updater function to merge start time into new object
		const progress = ({ loaded, total }) => setUploading(({start}) => ({ start, loaded, total }));
		// Upload complete = delete progress readout
		// Hack: Wait half a second so file should be available in nginx when we try to display preview
		const load = () => setTimeout(() => setUploading(false), 500);

		accepted.forEach(async file => {
			if (onFileSelect) {
				const passValidation = await onFileSelect(file);
				if (!passValidation) {
					console.error("File validation failed.");
					setInputStatus({path:path.concat(prop), status:"error", message:"File validation failed for "+file.name});
					return;
				}
			}

			const uploadOptions = {};
			if (uploadParams) uploadOptions.params = uploadParams;
			if (endpoint) uploadOptions.endpoint = endpoint;

			ServerIO.upload(file, progress, load, uploadOptions)
				.done(response => {
					// TODO refactor to clean this up -- we should have one way of doing things.
					// Different forms for UploadServlet vs MediaUploadServlet
					let url = response.cargo.url; // raw
					if (response.cargo[version] && response.cargo[version].url) {
						url = response.cargo[version].url; // e.g. prefer mobile
					}
					if (onUpload) {
						onUpload({ path, prop, response, url });
					}
					// Hack: Execute the onChange function explicitly to update value & trigger side effects
					// (React really doesn't want to let us trigger it on the actual input element)
					if (onChange) {
						onChange({...fakeEvent, target: { value: url }});
					}
				})
				.fail(res => res.status == 413 && notifyUser(new Error(res.statusText)));
				// Record start time of current upload
				setUploading({start: new Date().getTime()});
		});
		rejected.forEach(file => {
			// TODO Inform the user that their file had a Problem
			console.error("rejected :( " + file);
		});
	};

	// New hooks-based DropZone - give it your upload specs & an upload-accepting function, receive props-generating functions
	const { getRootProps, getInputProps } = useDropzone({accept: acceptTypes[type], onDrop, disabled: otherStuff.disabled});

	// Catch special background-colour name for img and apply a special background to show img transparency
	let className;
	if (bg === 'transparent') {
		bg = '';
		className = 'stripe-bg';
	}

	// For images which will be retrieved via Good-Loop media cache: allow user to mark as "always fetch original size"
	let extraControls = [];
	if (type === 'imgUpload' && cacheControls) {
		const toggleWart = (state) => {
			// Add or remove 'noscale' hash-wart
			const newUrl = hashWart(storeValue, /noscale/, state ? 'noscale' : null);
			onChange && onChange({...fakeEvent, target: { value: newUrl }});
		}
		const checked = storeValue && storeValue.match(/\#(.*_)?noscale\b/);
		extraControls.push(
			<FormGroup inline check key='cacheControls'>
				<FormControl disabled={ ! storeValue} name="noscale" type="checkbox" onChange={event => toggleWart(event.target.checked)} checked={checked} />
				<Label for="noscale" check>No auto-scale</Label>
			</FormGroup>
		);
	}

	// For images which might be displayed in a circle: allow user to mark as "scale to XX% size to fit in circle"
	if (type == 'imgUpload' && circleCrop) {
		const updateWart = (percent) => {
			const newWart = (percent == 100) ? '' : `ccrop:${percent}`;
			const newUrl = hashWart(storeValue, /ccrop:\d+/, newWart);
			onChange && onChange({...fakeEvent, target: { value: newUrl }});
		};
		const wart = storeValue && storeValue.match(/#.*ccrop:(\d+)/);
		const cropValue = (wart && wart[1]) || 100;

		const events = {
			onChange: event => updateWart(event.target.value),
			onFocus: () => setPreviewCrop(true),
			onBlur: () => setPreviewCrop(false),
		};
		extraControls.push(
			<FormGroup inline key='circleCrop'>
				<Label for="ccrop">Scale in circle:</Label>{' '}
				<FormControl style={{width: '4em', display: 'inline'}} name="ccrop" type="number" value={cropValue} {...events} /> %
			</FormGroup>
		);
	}

	let preview = null;
	if (uploading) {
		// Upload in progress: show % done report
		preview = <UploadProgress {...uploading} />;
	} else if (storeValue) {
		// File already uploaded: show media preview if possible
		// While the circle-crop control is focused, preview its effects by overlaying a scaled circle
		let circleOverlay = null;
		if (previewCrop) {
			const wart = storeValue && storeValue.match(/#.*ccrop:(\d+)/);
			const ccVal = (wart && wart[1]) || 100;
			circleOverlay = <div style={{...circleStyle, width: `${10000/ccVal}%`, height: `${10000/ccVal}%`}} />;
		}
		preview = <>
			<Thumbnail className={className} background={bg} url={storeValue} />
			{circleOverlay}
		</>;
	}

	return (
		<div>
			{collapse && <Button className="pull-left" title="upload media" onClick={e => setCollapsed( ! collapsed)} color="secondary" size={size}><Icon color="white" name="outtray" /></Button>}
			{isOpen && <>
				{!noUrl && <FormControl type="url" name={prop} value={storeValue} onChange={onChange} {...otherStuff} />}
				<div className={space('DropZone pull-left my-1 p-1', otherStuff.disabled && 'disabled')} {...getRootProps()}>
					<input {...getInputProps()} />
					<small>Drop a {acceptDescs[type]} here</small>
				</div>
			</>}
			{preview && <div className="pull-right" style={typesWithThumbnail[type] && thumbnailStyle}>{preview}</div>}
			{extraControls}
			<div className="clearfix" />
		</div>
	);
}; // ./imgUpload


const baseSpec = {
	$Widget: PropControlUpload2,
	validator: urlValidator
};

// Externally these are identical - they just sniff their own type internally & change behaviour on that basis.
registerControl({type: 'imgUpload', ...baseSpec });
registerControl({ type: 'videoUpload', ...baseSpec });
registerControl({ type: 'bothUpload', ...baseSpec });
// Fonts!
registerControl({ type: 'fontUpload', ...baseSpec });
// data
registerControl({ type: 'spreadsheetUpload', ...baseSpec });
// Upload anything!?
registerControl({ type: 'upload', ...baseSpec });


/**
 * image or video upload. Uses Dropzone
 * @param {Object} p
 * @param {string} p.type upload|imgUpload|spreadsheetUpload
 * @param {?string} p.endpoint Specify an endpoint. Defaults to ServerIO settings, usually https://uploads.good-loop.com/
 * @param {Boolean} p.collapse ??
 * @param {boolean} p.noUrl
 * @param {(file: File) => Promise<boolean>} p.onFileSelect Called before uploading, should return a boolean.
 * TODO if validation fails we should provide a helpful message to the user
 * @param {Function} p.onUpload {path, prop, url, response: the full server response} Called after the server has accepted the upload.
 * @param {?string} version mobile|raw|standard -- defaults to raw
 * @param {?Boolean} cacheControls Show "don't use mediacache to resize, always load full-size" hash-wart checkbox
 * @param {?Boolean} circleCrop Show "crop to X% when displayed in a circle" hash-wart control
 */
function PropControlUpload({type="upload", ...p}) {
	return <PropControl type={type} {...p} />
}

export default PropControlUpload;
