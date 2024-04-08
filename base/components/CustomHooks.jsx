import React, {useRef, useEffect, useState} from 'react';
import ServerIO from '../plumbing/ServerIOBase';


/** Takes React element reference. Calculates if div is visible to user or not 
 * 
 * TEST: possible bug if the document is wider than the screen
 * 
*/
const doIfVisible = props => {
	const {elementReference, fn} = props;
	if (!elementReference) return; // race conditions (?) can make reference undefined

	const {top, left, bottom, right} = elementReference.getBoundingClientRect();

	// ?? is window.innerWidth right? It can be bigger than the viewing area!
	const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
	const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

	// True if div is completely visible
	const isVisible = top >= 0 && left >= 0 && bottom <= viewportHeight && right <= viewportWidth;

	if (isVisible) {
		fn(props);
	}
};

const useDoesIfVisible = (fn, elementReference) => {
	const [isVisible, setIsVisible] = useState(false);

	let scrollListener;

	// TODO: Is currently a bug where listener will attempt to track element that no longer exists
	// as the user has switched page
	// Happens because below hook is not being called on component unmount
	useEffect(() => {
		// Initial call incase component is visible without scrolling
		doIfVisible({elementReference: elementReference.current, fn: () => setIsVisible(true)})

		scrollListener = window.addEventListener(
			'scroll',
			// Pass in reference to actual DOM element
			() => doIfVisible({
				elementReference: elementReference.current,
				fn: () => setIsVisible(true),
			})
		);
		return () => window.removeEventListener('scroll', scrollListener);
	}, [elementReference]);

	// Trigger function when component becomes visible for the first time
	useEffect(() => {
		if(isVisible) fn();
	}, [isVisible]);

};

const useDoOnResize = ({resizeFn}) => {
	useEffect(() => {
		// Call on first render
		resizeFn();

		// Recalculate if size changes
		// NB: This may be called twice on some devices. Not ideal, but doesn't seem too important
		window.addEventListener('resize', resizeFn);
		window.addEventListener('orientationchange', resizeFn);

		return () => {
			window.removeEventListener('resize', resizeFn);
			window.removeEventListener('orientationchange', resizeFn);
		};
	}, []);
};

export {
	useDoesIfVisible,
	useDoOnResize
};
