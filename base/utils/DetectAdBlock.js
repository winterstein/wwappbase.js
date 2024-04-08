import DataStore from '../plumbing/DataStore';
import PromiseValue from '../promise-value';

const path = ['misc', 'adBlockEnabled'];

/** Will set DataStore flag if the user has adblock enabled 
 * @returns {Promise}
*/
const doDetect = () => {
	const $script = document.createElement('script');
	// Based on https://www.detectadblock.com/
	// Adblockers are expected to always block js files with "ads" in the name
	$script.setAttribute('src', 'https://ads.good-loop.com/ads.js?cachebuster=' + Date.now());

	let pv = PromiseValue.pending();
	$script.onload = () => {
		// If adblocker enabled, ads.js will not be able to create div with id #aiPai9th 
		const adBlockEnabled = ! document.getElementById('aiPai9th');
		// DataStore.setValue(path, adBlockEnabled);
		pv.resolve(adBlockEnabled);
	};

	$script.onerror = () => {
		// We might not be connected to internet at all - make another check
		const $img = document.createElement('img');
		$img.setAttribute('id', 'adblockTesterImg');
		$img.setAttribute('src', 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png?cachebuster=' + Date.now());

		// Google's logo should be snappy, and we don't want to wait ages to confirm an adblock - can afford some error
		setTimeout(() => {
			if (!pv.resolved && !pv.error) {
				// No internet!
				pv.reject("offline");
			}
		}, 1500);

		$img.onload = () => {
			// Don't escape this function - allows for correcting false readings
			// Image loaded so internet exists but ads were blocked
			// DataStore.setValue(path, true);
			pv.resolve(true);
		}

		$img.onerror = () => {
			// Escape this if already timed out
			if (pv.resolved || pv.error) return;
			// We cannot load anything - no internet
			pv.reject("offline");
		}
	};

	document.head.appendChild($script);
	return pv.promise;
};

/**
 * @returns {PromiseValue} a PromiseValue, value=true means there _is_ an adblocker present.
 */
const detectAdBlock = () => DataStore.fetch(path, doDetect);

export default detectAdBlock;
