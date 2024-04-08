import React, { useEffect, useRef, useState } from "react";
import DataStore from "../plumbing/DataStore";
import NGO from "../data/NGO";
import { assert } from "../utils/assert";
import BG from "./BG";

/**
 * Displays an image from the NGO. If no NGO is provided, acts as a normal image
 * @param {NGO} ngo
 * @param {?Boolean} main use the main photo
 * @param {?Boolean} header use the header photo
 * @param {?Boolean} backdrop use a random photo that is marked as backdrop friendly
 * @param {Number} imgIdx use a specific image from the image list
 * @param {?Boolean} bg render as a BG component instead
 * @param {?String} src if no NGO is set, will render this like a normal image as a fallback (defaults to main photo). 
 * 	If no src and no NGO, then render null.
 * @param {?Boolean} hardFallback instead of returning null on no image found, fallback as much as possible
 * @param {?JSX} children For use with bg
 * @param {?Boolean} alwaysDisplayChildren if true, will return children on empty background when no image can be sourced instead of null (with bg option)
 */
const NGOImage = ({ngo, main, header, backdrop, imgIdx, bg, src, hardFallback, children, alwaysDisplayChildren, ...props}) => {
	assert(imgIdx !== undefined || main || header || backdrop); // temporary

	const [useUrl, setUseUrl] = useState();
	const [randIdx, setRandIdx] = useState(-1);

	const ImgType = bg ? BG : "img";
	if (children && !bg) {
		console.warn("NGOImage set to normal image but given children - will not correctly render!");
	}

	useEffect (() => {
		if (ngo) {
			// Use main if specified
			if (main) setUseUrl(ngo.images);
			// Use header if specified
			if (header) {
				setUseUrl(ngo.headerImage);
				if ( ! useUrl) {
					// TODO Hm: could we use a composite image to create a banner effect?
					setUseUrl(ngo.images);
				}
			}
			if (backdrop && ngo.imageList) {
				const useableImages = ngo.imageList.filter(imgObj => imgObj.backdrop);
				if (useableImages.length > 0) {
					// Use states to prevent random selections reoccuring every re-render
					let newIdx = Math.floor(Math.random()*useableImages.length);
					if (randIdx === -1) {
						setRandIdx(newIdx);
					} else {
						newIdx = randIdx;
					}
					let selImg = useableImages[newIdx];
					setUseUrl(selImg.contentUrl);
				}
			}
			if (imgIdx !== null && ngo.imageList && ngo.imageList[imgIdx]) {
				const useableImages = ngo.imageList.filter(imgObj => !imgObj.backdrop);
				setUseUrl(useableImages.length > imgIdx ? useableImages[imgIdx].contentUrl : ngo.images);
			} else if (hardFallback) {
				setUseUrl(ngo.images);
			}
		}
	}, [ngo, main, header, backdrop, imgIdx]);

	const finalUrl = useUrl || src;
	if ( ! finalUrl) {
		if (bg && alwaysDisplayChildren) {
			return {children};
		}
		return null; // no fallback? then no render
	}

	// ??what is the id used for? Is it for debug purposes??
	return <ImgType src={finalUrl} id={"imageList-" + imgIdx + "-contentUrl"} {...props}>{children}</ImgType>;
};

export default NGOImage;
