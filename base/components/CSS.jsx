/**
 * A css node for custom css
 */
import React, {useState, useRef} from 'react';


// /**
//  * Create a CSS node containing the literal string provided
//  */
// const CSS = ({css, nodeId, insertionPoint = document.head}) => {
// 	if ( ! css) return null;
// 	if (done[css]) return null;
// 	const styleNode = document.createElement('style');
// 	styleNode.type = 'text/css';
// 	if (nodeId) styleNode.id = nodeId;
// 	if (styleNode.styleSheet) { // IE8 support TODO Really just IE8? Why do we have this?
// 		styleNode.styleSheet.cssText = css;
// 	} else { // literally every other browser
// 		styleNode.appendChild(document.createTextNode(css));
// 	}
// 	insertionPoint.appendChild(styleNode);

// 	// Remember to clean up later, if the
// 	addUninstallAction({ action: () => (insertionPoint && insertionPoint.removeChild(styleNode)) });
// };

/**
 *
 * @deprecated Use StyleBlock instead -- which plays nicer with VS Code auto-complete / eslint handling.
 * 
 * @param {String} css
 * 
 * NB: Why an attribute instead of tag-contents? because {}s are special characters for jsx and for css -- using the tag contents isnt so good.
 */
const CSS = ({css}) => {
	return css && css.length? <style>{css}</style> : null;
};

export default CSS;
