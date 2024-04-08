import React from 'react';
import html2canvas from 'html2canvas';
// Doesn't need to be used, just imported so MiniCSSExtractPlugin finds the LESS
import CSS from '../style/png-download.less';
import { stopEvent } from '../utils/miscutils';

/**
 * Force the browser to download a data URL.
 * @see: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
 *
 * @param {string} dataUrl - The Data URL string to be downloaded
 * @param {string} filename - An optional filename - will default to 'image.png' if not set
 */
const saveAs = (dataUrl, fileName) => {
	console.log(`filename: ${fileName}`);
	var link = document.createElement('a');
	if (typeof link.download === 'string') {
		link.href = dataUrl;
		link.download = `${fileName}.png`;

		// Firefox requires the link to be in the body
		document.body.appendChild(link);

		link.click();

		// Remove the link when done
		document.body.removeChild(link);
	} else {
		window.open(dataUrl);
	}
}

const screenshotIcon = (
	<svg viewBox="0 0 100 100" className="screenshot-icon">
		<g style={{fill: '#000', stroke: 'none'}}>
			<path d="M5 5v25h5V10h20V5ZM95 5H70v5h20v20h5zM5 95h25v-5H10V70H5ZM95 95V70h-5v20H70v5z" />
			<path d="M45 20c-5.54 0-10 4.46-10 10H25c-5.54 0-10 4.46-10 10v30c0 5.54 4.46 10 10 10h50c5.54 0 10-4.46 10-10V40c0-5.54-4.46-10-10-10H65c0-5.54-4.46-10-10-10H45zm5 17.5c9.635 0 17.5 7.865 17.5 17.5S59.635 72.5 50 72.5 32.5 64.635 32.5 55 40.365 37.5 50 37.5zm0 5c-6.933 0-12.5 5.567-12.5 12.5S43.067 67.5 50 67.5 62.5 61.933 62.5 55 56.933 42.5 50 42.5z" />
		</g>
	</svg>
);

/**
 * Export an element in the DOM as a png image using html2canvas
 * NB: html2canvas doesn't work well with elements which have a `box-shadow` property.
 * You can remove that using a custom onCloneFn. Or, you can try setting the `scale` to 1.25
 * in the opts property.
 * 
 * @param {string} querySelector - A query selector for the DOM element we want to export
 * @param {string} [fileName="image"] - The filename to use for the exported image. ".png" is added to this.
 * @param {function} [onCloneFn] - If an onclone function is specified, a clone of the DOM will be made before
 *                               saving the image. This cloned DOM can be manipulated without affecting the
 *                               original DOM. 
 * @param {object} [opts] - Configuration options to be passed to html2canvas. See: https://html2canvas.hertzen.com/configuration 
 * 
 * @returns a download button
 */
export const PNGDownloadButton = ({querySelector, onCloneFn, title = 'Click to save this element as .PNG', opts = {}, fileName = 'image', delay=0}) => {
	const doScreenshot = event => {
		stopEvent(event);
		setTimeout(() => {
			html2canvas(document.querySelector(querySelector), {
				onclone: (document) => {
					// Hide all elements with the "hide for screenshots" marker class (including this button)
					document.querySelectorAll('.screenshot-hide').forEach(node => {
						node.style.display = 'none';
					});
					onCloneFn && onCloneFn(document);
				},
				...opts
			}).then(canvas => {
				saveAs(canvas.toDataURL(), fileName);
			});
		}, delay)

	};

	return (
		<a className="png-export screenshot-hide" onClick={doScreenshot} title={title}>
			{screenshotIcon}
		</a>
	);
}

export default PNGDownloadButton;
