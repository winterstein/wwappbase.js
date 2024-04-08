// Copy this file to $YOURHOSTNAME.js and re-run webpack to override constants in ServerIO.
// After creating the file, further changes will be detected by webpack and trigger a rebuild.
// You don't have to commit it, but it won't affect any other machines if you do.
// The setup below is only an example - you can mix and match servers and hardcode whatever you want.

// Change index to switch all endpoints together
const cluster = ['', 'stage', 'test', 'local'][2];

// Change to "http" if you don't have SSL set up locally
const PROTOCOL_LOCAL = 'https';
const protocol = (cluster === 'local') ? PROTOCOL_LOCAL : 'https';

export const ServerIOOverrides = {
	APIBASE: `${protocol}://${cluster}portal.good-loop.com`,
	AS_ENDPOINT: `${protocol}://${cluster}as.good-loop.com`,
	PORTAL_ENDPOINT: `${protocol}://${cluster}portal.good-loop.com`,
	DEMO_ENDPOINT: `${protocol}://${cluster}demo.good-loop.com`,
	DATALOG_ENDPOINT: `${protocol}://${cluster}lg.good-loop.com/data`,
	MEDIA_ENDPOINT: `${protocol}://${cluster}uploads.good-loop.com`,
	ANIM_ENDPOINT: `${protocol}://${cluster}portal.good-loop.com/_anim`,
	CHAT_ENDPOINT: `${protocol}://${cluster}chat.good-loop.com/reply`,
	MEASURE_ENDPOINT: `${protocol}://localmeasure.good-loop.com/measure`,
	// DATALOG_DATASPACE: 'gl',
	// ENDPOINT_NGO: 'https://test.sogive.org/charity',
	// JUICE_ENDPOINT: 'https://localjuice.good-loop.com',
	// ADRECORDER_ENDPOINT: 'http://localadrecorder.good-loop.com/record',
};