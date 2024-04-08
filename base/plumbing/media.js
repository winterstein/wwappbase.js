
// TODO utilities for smart handling of hi/lo res images

/**
 * @param {?String} urlString A media (image/video) URL
 * @returns {?String} A URL which will retrieve a original/standard/mobile copy of the file from the Good-Loop media server
 */
const hiloUrl = urlString => {
	if ( ! urlString) return null;
	// is it a media.gl.com url?
	if (urlString.includes("media.good-loop.com")) {}

	// for ref - adunit wrapUrl code
	// // Put a protocol on protocol-relative URLs to enable parsing
	// if (urlString.match(/^\/\//)) {
	// 	urlString = 'https:' + urlString;
	// }

	// const url = parseUrl(urlString);
	// if (url.hostname.match(/good-loop.com$/)) return urlString; // Our domain? Use it uncached
	// if (!url.protocol.match(/http/)) return urlString; // Not HTTP (eg data: url)? Use it uncached

	// // This is going to be used as a filename/URL, so '/' in the encoded string is unsafe
	// // However, there's a URL + filesystem-safe base64 standard we can transform to easily
	// // See https://tools.ietf.org/html/rfc4648#section-5
	// const urlEncoded = btoa(urlString).replace('+', '-').replace('/', '_');
	// // preserve extension because MIME-type at the server side is going to be based on wild filename-based guesses
	// const extension = urlString.substr(urlString.lastIndexOf('.')).replace(/[?#].*/, ''); // don't preserve query/hash though

	// return process.env.MBURL + '/uploads/mediacache/' + urlEncoded + extension + '?from=good-loop-ad-unit';

	return urlString;
};

