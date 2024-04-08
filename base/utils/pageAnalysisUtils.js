import ServerIO from "../plumbing/ServerIOBase";
import { noVal } from "./miscutils";

const MEASURE_ENDPOINT_BASE = ServerIO.MEASURE_ENDPOINT.replace(/\/measure$/, '');
export const PROXY_ENDPOINT = `${MEASURE_ENDPOINT_BASE}/proxy`;
export const RECOMPRESS_ENDPOINT = `${MEASURE_ENDPOINT_BASE}/recompress`;
export const EMBED_ENDPOINT = `${MEASURE_ENDPOINT_BASE}/embed`;


export function storedManifestForTag(tag) {
	return `${MEASURE_ENDPOINT_BASE}/persist/greentag_${tag.id}/results.json`;
}


/**
 * Make something that may not be an array (or even exist) into an array, without nesting things that already are.
 * Doesn't recurse in - consider Lodash flattenDeep for that.
 */
export function arrayify(thing) {
	if (noVal(thing)) return [];
	if (Array.isArray(thing)) return [...thing];
	return [thing];
};


/**
 * Pulls out a named property from every node in a tree of homogeneous nodes.
 * e.g. to pull all transfers out of a manifest including those in subframes, call flattenProp(manifest, 'transfers', 'frames');
 * @param {object} root The root node of the tree
 * @param {string} propKey The name of the property to extract
 * @param {string} childKey The name under which each node's children are stored
 * 
 * @return {*[]} Every instance of the named property in the tree, ordered depth-first
 */
export function flattenProp(root, propKey, childKey) {
	const items = [];
	if (root[propKey]) items.push(...arrayify(root[propKey]));

	root[childKey]?.forEach(branch => {
		items.push(...flattenProp(branch, propKey, childKey));
	});
	return items;
}


/**
 * Generates a short display name for a URL.
 * Returns either:
 * - the "filename" part of the URL (eg https://www.domain.tld/dir/filename.ext --> "filename.ext")
 * - the last "directory" part  (eg https://www.domain.tld/dir/subdir/ --> "subdir/"
 * - "/" for domain root
 * - "[Strange URL]" if none of the above can be found
 */
export function shortenName(transfer) {
	let matches = null;
	try {
		matches = new URL(transfer.url).pathname.match(/\/([^/]*\/?)$/);
	} catch (e) { /* Malformed URL - oh well. */ }
	if (matches) return matches[1] || matches[0]; // if path is "/", match will succeed but group 1 will be empty
	return '[Strange URL]';
};


/** Very quick and dirty CORS-stripping proxy using FileProxyServlet */
export function proxy(url) {
	const proxied = new URL(PROXY_ENDPOINT);
	proxied.searchParams.append('url', url);
	return proxied.toString();
}


/** Regexes matching MIME types and filenames for some more and less specific classes of file */
const typeSpecs = {
	font: { mime: /^(application\/)?font/, filename: /\.(ttf|otf|woff2?)$/i }, // normally "font/xxxx" but "application/font-xxxx" also sighted
	image: { mime: /^image/, filename: /\.(jpe?g|gif|png|tiff?|bmp)$/i },
	audio: { mime: /^audio/, filename: /\.(wav|aiff|mp3|ogg|m4a|aac|flac|alac)$/i },
	video: { mime: /^video/, filename: /\.(m4v|mp4|mpeg4|mpe?g|mov|webm|avi)$/i },
	script: { mime: /javascript$/, filename: /\.js$/i }, // text/javascript and application/(x-)javascript both seen in the wild
	stylesheet: { mime: /css$/, filename: /\.css$/i },
	html: { mime: /^text\/html$/, filename: /\.html?$/i },
	svg: { mime: /^image\/svg$/, filename: /\.svg$/i },
	avif: { mime: /^image\/avif$/, filename: /\.avif$/i },
	webp: { mime: /^image\/webp$/, filename: /\.webp$/i },
	gif: { mime: /^image\/gif$/, filename: /\.gif$/i }, // specifically suggest replacing GIF with video / multiframe WEBP
	woff: { mime: /woff2?$/, filename: /\.woff2?$/i }, // Includes WOFF and WOFF2
	woff2: { mime: /woff2$/, filename: /\.woff2$/i }, // WOFF2-only
	audioLossless: { mime: /^audio/, filename: /\.(wav|flac|alac)$/i }, // Warn about unnecessary use of lossless audio
};


/** Quick check for whether a given transfer's MIME type or extension matches a file class */
export function isType(transfer, type) {
	const spec = typeSpecs[type];
	return transfer.mimeType?.match(spec.mime) || transfer.path?.match(spec.filename);
}


/** Helper for classifying transfers when constructing the type breakdown */
const testTransfer = (transfer, manifest, type, ownFrame) => {
	// Does the transfer belong to a sub-frame when we only want directly owned transfers?
	if (ownFrame && manifest.transfers.indexOf(transfer) < 0) return false;
	// Is the transfer the wrong type?
	if (type && !isType(transfer, type)) return false;
	return true;
};


/** Classes of data for the type breakdown */
const lineSpecs = [
	{ title: 'HTML', typeSpec: 'html', color: '#003f5c' },
	{ title: 'Images', typeSpec: 'image', color: '#374c80' },
	{ title: 'Video', typeSpec: 'video', color: '#7a5195' },
	{ title: 'Audio', typeSpec: 'audio', color: '#bc5090' },
	{ title: 'Javascript', typeSpec: 'script', color: '#ef5675' },
	{ title: 'Fonts', typeSpec: 'font', color: '#ff764a' },
	{ title: 'Stylesheets', typeSpec: 'stylesheet', color: '#ffa600' },
	// { title: 'Other Types' }, // Inserted dynamically in typeBreakdown
];


/**
 * What types of transfers make up the page's data usage?
 * @param {object} manifest Page manifest to analyse
 * @param {boolean} flatten Show transfers belonging to sub-frames in the breakdown
 */
export function typeBreakdown(manifest, separateSubframes) {
	const pageBytes = manifest.resHeaders + manifest.resBody;
	const allTransfers = flattenProp(manifest, 'transfers', 'frames');
	let bytesAccountedFor = 0;

	const lines = lineSpecs.map(({title, typeSpec, color}) => {
		const transfersForType = allTransfers.filter(t => testTransfer(t, manifest, typeSpec, separateSubframes));
		const bytes = transfersForType.reduce((acc, t) => acc + t.resHeaders + t.resBody, 0);
		bytesAccountedFor += bytes;
		return { title, bytes, fraction: (bytes / pageBytes), color };
	});

	const extraLines = [];
	// Generate "transfers in sub-frames" line
	if (separateSubframes) {
		const subFrameTransfers = allTransfers.filter(t => manifest.transfers.indexOf(t) < 0);
		const subFrameBytes = subFrameTransfers.reduce((acc, t) => acc + t.resHeaders + t.resBody, 0);
		bytesAccountedFor += subFrameBytes;
		extraLines.push({ title: 'Sub-frame content', bytes: subFrameBytes, color: '#ff00ff' });
	}
	// Any data that didn't match any of the filters in breakdownTypes?
	const otherBytes = Math.max(pageBytes - bytesAccountedFor, 0);
	const otherEntry = { title: 'Other Types', bytes: otherBytes, color: '#00ffff' };
	extraLines.unshift(otherEntry); // "other" goes before "sub-frames" if present

	// Concatenate, remove zeroes, and add "fraction of whole page" number
	return [...lines, ...extraLines]
		.filter(a => !!a.bytes)
		.map(line => ({ ...line, fraction: line.bytes / pageBytes }));
}


/** Total bytes transferred under a PageManifest or Transfer. */
export const transferTotal = t => (t.reqHeaders + t.reqBody + t.resHeaders + t.resBody);
