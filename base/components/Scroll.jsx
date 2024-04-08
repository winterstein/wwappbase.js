import React, { useRef, useState } from "react";

/**
 * @param {?boolean} once Only scroll once. It is a good idea to set this _or_ `watch`, but not both.
 * @param {?string} watch Scroll again if this changes. You cannot set this and `once`.
 */
 export const ScrollIntoView = ({once, watch, top=false}) => {
	const endRef = useRef();	
	assert( ! (once && watch));
	if ( ! watch) watch = "once";	
	let [done, setDone] = useState();			
	if (endRef.current) {
		// do once to allow the user to scroll away?
		if ( ! done || done !== watch) {
			console.log("scroll...");
			endRef.current.scrollIntoView(top);
			setDone(watch);
		}
	}
	return <div ref={endRef} />;
};

