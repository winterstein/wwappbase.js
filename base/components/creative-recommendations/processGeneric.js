import ServerIO from '../../plumbing/ServerIOBase';
import { RECOMPRESS_ENDPOINT } from '../../utils/pageAnalysisUtils';


/** Helper for optimisations - e.g. unused resource or script replacement - that don't involve the server. */
export function processLocal(transfer, type, extraData) {
	console.log('processLocal (eg skip, unused, JS replacement)', type, transfer);
	return new Promise(resolve => resolve({ ...transfer, type, outputs: [], optimised: true, ...extraData }));
}


/** Call /recompress - boilerplate for standard params and response */
export function callRecompressServlet(transfer, type, extraData) {
	console.log("callRecompressServlet", type, transfer);
	const data = { url: transfer.url, type, referrer: transfer.frame.url, ...extraData };

	return ServerIO.load(RECOMPRESS_ENDPOINT, { data }).then(res => {
		return { ...transfer, type, outputs: res.data.outputs, optimised: true };
	});
}


export function processEmpty(transfer) {
	return processLocal(transfer, { message: 'Empty transfer.' });
}


export function processGif(transfer) {
	// Ignore tiny images like tracking pixels and interface buttons
	if (transfer.bytes < 3000) {
		const { url, bytes } = transfer;
		return processLocal(transfer, 'image', { outputs: [{ url, bytes, messages: [`Ignoring tiny file (${transfer.bytes} bytes)`], noop: true }] });
	};
	return callRecompressServlet(transfer, 'gif');
}


export function processSvg(transfer) {
	return callRecompressServlet(transfer, 'svg');
}


const scriptReplacements = [
	{
		pattern: /tweenmax.+(\.min)?\.js/i,
		url: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js',
		// TODO bring React into this JS file or enable links etc by some other means?
		// message: <><A href="https://greensock.com/3/">GSAP 3</A> is a drop-in replacement for TweenMax.</>,
		message: 'GSAP 3 is a drop-in replacement for TweenMax.',
		bytes: 23942
	},
];


export function processScript(transfer) {
	// Is there a simple replacement? (eg TweenMax --> GSAP 3)
	const scriptReplacement = scriptReplacements.find(({pattern}) => transfer.url.match(pattern));
	if (scriptReplacement) {
		const { url, bytes, message } = scriptReplacement;
		return processLocal(transfer, 'script', { outputs: [{url, bytes, messages: [message], isSubstitute: true }] });
	}

	// No - see if UglifyJS on the server can do anything.
	return callRecompressServlet(transfer, 'script');
}


export function processFont(transfer) {
	const { font } = transfer; // Usage in page

	// Couldn't find any text using this font: mark as "possibly unused"
	if (!font?.characters?.length) return processLocal(transfer, 'font', { unused: true });

	// Call servlet - subset and ensure format is WOFF2
	return callRecompressServlet(transfer, 'font', { characters: font.characters });
};