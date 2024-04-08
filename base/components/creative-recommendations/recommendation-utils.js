import processImage from './processImage';
import { processEmpty, processSvg, processGif, processFont, processScript } from './processGeneric';
import { flattenProp, isType, storedManifestForTag } from '../../utils/pageAnalysisUtils';
import { isURL, isHTML } from '../../utils/miscutils';


export const RECS_PATH = ['widget', 'creative-recommendations'];

export const RECS_OPTIONS_PATH = [...RECS_PATH, 'options'];


function manifestPathBit({tag, url, html, upload}) {
	const subPath = (tag && 'tag') || (url && 'url') || (html && 'html') || (upload && 'upload') || 'null';
	const endPath = tag?.id || url || html || upload || 'null';
	return [subPath, endPath];
}


/**
 * DataStore path for PageManifest corresponding to a particular Green Ad Tag.
 * @param p Should have only one of p.tag, p.url, p.html
 * @param {GreenTag} [p.tag] The Green Ad Tag the manifest is attached to
 * @param {String} [p.url] The analysed URL, if the manifest is not attached to a GAT
 * @param {String} [p.html] The analysed HTML fragment (script tag etc), if the manifest is not attached to a GAT
 */
export function savedManifestPath({tag, url, html, upload}) {
	return [...RECS_PATH, 'saved-tag-measurement', ...manifestPathBit({tag, url, html, upload})];
}


/**
 * DataStore path for list of recommendations pertaining to a particular page/creative/etc analysis.
 * De-duplicates on manifest timestamp (so a re-analysis is stored under a new path) and recommendation options
 * - so recs for the same manifest with e.g. retina and standard resolution selected are stored under different paths.
 * @param p Should have only one of p.tag, p.url, p.html
 * @param {GreenTag} [p.tag] The Green Ad Tag the manifest is attached to
 * @param {String} [p.url] The analysed URL, if the manifest is not attached to a GAT
 * @param {String} [p.html] The analysed HTML fragment (script tag etc), if the manifest is not attached to a GAT
 * @param {Object} [manifest] The PageManifest returned by MeasureServlet (or loaded from /persist/)
 */
export function processedRecsPath({tag, url, html}, manifest) {
	const allOptions = DataStore.getValue(RECS_OPTIONS_PATH);
	// Don't start a recompress if the options are unset.
	if (!allOptions) return null;
	// noWebp no longer changes how recompression is done, so leave it out of the deduplication string
	// TODO Do speculative retina/standard/compromise sizes too
	const {noWebp, ...options} = allOptions;
	const optionString = JSON.stringify(options);
	return [...RECS_PATH, 'processed-recs', ...manifestPathBit({tag, url, html}), manifest?.timestamp || 0, optionString];
}


/**
 * Augment a PageManifest in-place by adding a member "parentFrame" to every sub-frame & "frame" to every transfer.
 * This can't be done server-side, since it would break serialization.
 * @param {PageManifest} manifest From MeasureServlet
 */
function doubleLinkManifest(manifest) {
	const allFrames = flattenProp(manifest, 'frames', 'frames');
	allFrames.unshift(manifest);
	allFrames.forEach(frame => {
		// Link every transfer back to this frame - for e.g. getting referrer URL later
		frame.transfers.forEach(transfer => { transfer.frame = frame; });
		// Is there a frame whose "child frames" array contains the current frame? That's the parent.
		const parent = allFrames.find(candidate => candidate.frames.find(f => (f === frame)));
		if (parent) frame.parentFrame = parent;
	});
}


/**
 * Request a new analysis from MeasureServlet and store the response at the standard path.
 * @param p Should have only one of p.tag, p.url, p.html
 * @param {GreenTag} [p.tag] A Green Ad Tag to analyse
 * @param {String} [p.url] A URL to analyse
 * @param {String} [p.html] A HTML fragment to analyse
 * @returns {Promise} Resolves to the MeasureServlet response.
 */
export function startAnalysis({tag, url, html}) {
	if (!tag?.id && !url && !html) return;
	const path = savedManifestPath({tag, url, html});

	// Remove any previously-stored analysis
	DataStore.setValue(path, null);
	const data = {};

	// Check for misplaced URL/HTML and swap
	if (tag?.creativeHtml && !html) html = tag.creativeHtml;
	if (tag?.creativeURL && !url) url = tag.creativeURL;
	if (html && isURL(html)) {
		(url = html) && (html = null);
	} else if (url && isHTML(url)) {
		(html = url) && (url = null);
	}
	if (tag) data.tagId = tag.id;
	if (url) data.url = url;
	if (html) data.html = html;

	// Call MeasureServlet!
	return ServerIO.load(ServerIO.MEASURE_ENDPOINT, { data }).then(res => {
		if (res.error) throw new Error(res.error);
		res.data.forEach(doubleLinkManifest); // Add parent info for easy frame navigation
		// Store results in the standard location
		DataStore.setValue(path, res.data);
		return res;
	});
};


/**
 * Receive & store an analysis of a ZIP file uploaded to MeasureServlet.
 * @param res Response from MeasureServlet.
 */
export function receiveUploadAnalysis(res) {
	res.data.forEach(doubleLinkManifest); // Add parent info for easy frame navigation
	// Store results in the standard location
	DataStore.setValue(savedManifestPath({upload: 'upload'}, res.data));
}


/**
 * Attempt to find a saved manifest on the measurement server associated with a Green Ad Tag.
 * @param {GreenTag} tag
 * @returns {PromiseValue} A DataStore.fetch PV.
 */
export function fetchSavedManifest(tag) {
	return DataStore.fetch(savedManifestPath({tag}), () => {
		// fetchFn returning null is OK - no tag means stored-manifest-for-tag should resolve null
		if (!tag) return null;
		// Static file fetch, rather than backend resource - we need to specify no caching,
		// as successive analyses overwrite this JSON file & delete images pertaining to previous versions.
		return ServerIO.load(storedManifestForTag(tag), {swallow: true, cache: false}).then(res => {
			res.data.forEach(doubleLinkManifest); // Add parent info for easy frame navigation
			return res;
		});
	});
}


/**
 * Generates a short display name for a URL.
 * Returns either:
 * - the "filename" part of the URL (eg https://www.domain.tld/dir/filename.ext --> "filename.ext")
 * - the last "directory" part  (eg https://www.domain.tld/dir/subdir/ --> "subdir/"
 * - "/" for domain root
 * - "[Strange URL]" if none of the above can be found
 */
export function shortenName(url) {
	let matches = null;
	try {
		matches = new URL(url).pathname.match(/\/([^/]*\/?)$/);
	} catch (e) { /* Malformed URL - oh well. */ }
	if (matches) return matches[1] || matches[0]; // if path is "/", match will succeed but group 1 will be empty
	return '[Strange URL]';
};


/**
 * Find potential optimisations for an individual file.
 * @param {Transfer} transfer A Transfer object (see Transfer.java)
 * @returns {Promise} Resolves to a copy of the original transfer, augmented with extra recommenendation info
 * - or rejects with a reason no recommendation could be given.
*/
export function processTransfer(transfer) {
	console.log('processTransfer', transfer.mimeType, transfer.totalDataTransfer, transfer.url);
	// Can only process files we can fetch over HTTP for now
	// TODO Inline SVGs, some day
	if (!transfer.url.match(/^http/)) {
		console.log('reject non-http', transfer.mimeType, transfer.totalDataTransfer, transfer.url);
		if (isType(transfer, 'image')) { // HACK: fail gracefully for e.g. SeenThis streaming images which are data blobs
			// NB: copy-pasta from processLocal()
			let message = 'Can\'t process non-HTTP transfer';
			return new Promise(resolve => resolve({ ...transfer, type: 'image', optUrl: null, optBytes: 0, optimised: true, message, noop: true}));
		}
		return new Promise((resolve, reject) => {
			reject('Can\'t generate recommendations for non-HTTP transfer', transfer);
		});
	}

	// TODO Mark processed transfers with options used so we can just regenerate the ones the new options affect?
	if (transfer.bytes === 0) {
		// Duplicate transfer - 0 bytes because it's a cache hit.
		return processEmpty(transfer);
	} else if (isType(transfer, 'font')) {
		return processFont(transfer);
	} else if (isType(transfer, 'svg')) {
		return processSvg(transfer);
		// TODO Offer raster conversion
	} else if (isType(transfer, 'gif')) {
		return processGif(transfer);
	} else if (isType(transfer, 'image')) {
		return processImage(transfer);
	} else if (isType(transfer, 'script')) {
		return processScript(transfer);
	}

	console.log('reject nope', transfer.mimeType, transfer.totalDataTransfer, transfer.url);
	return new Promise((resolve, reject) => reject('No recommendation function for transfer', transfer));
}


/** Sort recommendations, largest impact first */
function recsSortFn(a, b) {
	const srA = a.significantReduction;
	const srB = b.significantReduction;
	// Always sort "significant reduction" above "not", even if the absolute improvement of "not" is larger
	if (srA !== srB) return srA ? -1 : 1;
	// Sort pairs of "no reduction" items by size
	if (!srA) return b.bytes - a.bytes;
	// Both have reductions - sort highest first
	const rednA = a.bytes - a.optBytes;
	const rednB = b.bytes - b.optBytes;
	return rednB - rednA;
};


/**
 * For a transfer of a font file: Find a font spec from the page manifest with a matching URL & attach it.
 */
function augmentFont(transfer, fonts) {
	const fontSpecForTransfer = fonts[transfer.url];
	if (!fontSpecForTransfer) return;
	transfer.font = fontSpecForTransfer;
}


/**
 * For a transfer of an image or video file:
 * - Find any elements in the page manifest with the same source URL
 * - Attach those elements to the transfer
 */
function augmentMedia(transfer, mediaElements) {
	const matchedElements = mediaElements.filter(e => (e.resourceURL === transfer.url));
	matchedElements.forEach(el => {
		if (!transfer.elements) transfer.elements = [];
		transfer.elements.push(el);
	});
}


function worthItFn(bytes, optBytes) {
	// NB 0 bytes for "remove unused resource" is a legitimate value.
	if (!optBytes && optBytes !== 0) {
		return false;
	}
	const reduction = bytes - optBytes;
	if (bytes < 1024 || reduction < 0) return false;
	if (bytes < 10240) return (reduction > 1024);
	const proportion = reduction / bytes;
	if (bytes < 102400) return (proportion > 0.1);
	return proportion > 0.05;
}

/**
 * Do we bother saying we can optimise this file? Thresholds based on original size:
 * Under 1K: don't bother
 * Under 10K: must be at least 1K
 * Under 100K: must be at least 10%
 * Over 100K: Must be at least 5%
 * @param {Transfer} t
 * @returns {boolean}
 */
function evaluateReductions(transfer) {
	const { bytes } = transfer;
	transfer.outputs?.forEach(output => {
		const worthIt = worthItFn(bytes, output.bytes);
		if (!worthIt) return;
		// Mark the overall item as optimisable
		transfer.significantReduction = true;
		// Mark this individual recompression as good
		output.significantReduction = true;
	});
}


/** What's the best usable recompression candidate from this augmented Transfer object? */
export function getBestRecompression(transfer) {
	const { noWebp } = DataStore.getValue(RECS_OPTIONS_PATH);

	let bestOutput, bestSize = transfer.bytes; // Don't return outputs bigger than original as "best"
	transfer.outputs?.forEach(output => {
		// Don't use .webp recompresses in no-webp mode
		if (noWebp && output.format === 'webp') return;
		// TODO RecompressServlet to do speculative standard/retina/compromise resizes & allow switching here
		if (!bestSize || (output.bytes < bestSize)) {
			bestOutput = output;
			bestSize = output.bytes;
		}
	});
	return bestOutput;
}


/** Generate and store list of recommendations 
 * 
 * TODO doc notes on the data format
*/
export function generateRecommendations(manifest, path, separateSubFrames) {
	// Don't fire off multiple recommendation processes for the same spec!
	if (DataStore.getValue(path)?.processing) return;
	DataStore.setValue(path, {processing: true});

	// Pull out all transfers, font specs, and media-bearing elements
	// Don't make user think about frame hierarchies in e.g. creative analysis tool context - just look at all transfers.
	const allTransfers = separateSubFrames ? manifest.transfers : flattenProp(manifest, 'transfers', 'frames');
	// Fonts audit is an object (mapping filename to font spec), not a list, so needs to be merged down from a list of objects
	let allFonts = separateSubFrames ? manifest.fonts : flattenProp(manifest, 'fonts', 'frames').reduce((acc, fontsObj) => Object.assign(acc, fontsObj), {});
	const allMediaElements = separateSubFrames ? manifest.elements : flattenProp(manifest, 'elements', 'frames');

	// Start the recommendation-generation process & hold the promise for each transfer
	const optPromises = allTransfers.map(t => {
		// Pair up each font and media transfer with information on how it's used in the analysed page
		if (isType(t, 'image') || isType(t, 'video')) {
			augmentMedia(t, allMediaElements)
		} else if (isType(t, 'font')) {
			augmentFont(t, allFonts);
		}
		// Convenient info
		t.filename = shortenName(t.url);
		t.bytes = t.resBody;
		return processTransfer(t);
	});

	// Wait for all promises to resolve, then put in DataStore.
	// Would be nice to insert and sort as they come in, but that raises
	// horrible concurrency issues & JS atomics builtins are still very new.
	Promise.allSettled(optPromises).then(results => {
		const augTransfers = results.filter(r => r.status === 'fulfilled').map(r => r.value);
		// Flag transfers that have enough improvement to talk about
		augTransfers.forEach(evaluateReductions);
		augTransfers.sort(recsSortFn);
		DataStore.setValue(path, augTransfers);
	});
}


/** Specs for matching sites the analysis engine chokes on */
const badSiteSpecs = [
	{ hostname: 'drive.google.com', name: 'Google Drive' },
	{ hostname: /(we.tl|wetransfer.com)/, name: 'WeTransfer' },
	{ hostname: /celtra\.com$/, pathname: /shareablePreview/, name: 'Celtra Shareable Preview' },
	{ hostname: 'sneakpeek.yahooinc.com', name: 'Yahoo Sneak Peek' },
	{ hostname: 'preview.nexd.com', name: 'NEXD' },
	{ hostname: 'admanagerplus.yahoo.com', name: 'Yahoo! Ad Manager Plus' },
];

/**
 * Is the URL in question on a site our analysis engine can't properly process?
 * @param {string} url URL to check
 * @returns {boolean|string} False for OK, site name for "bad site"
 */
export function badSite(url) {
	if (!url) {
		return 'no url'; // i.e. falsy is bad
	}
	try {
		url = new URL(url);
	} catch (e) {
		return 'an invalid url'; // JS parser is quite lenient so this is definitely bad
	}
	const badSiteSpec = badSiteSpecs.find(({hostname, pathname}) => {
		if (hostname && url.hostname.match(hostname)) return true;
		if (pathname && url.pathname.match(pathname)) return true;
	});
	return !!badSiteSpec && badSiteSpec.name;
}
