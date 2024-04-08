import React, { useState } from 'react';
import { assMatch } from '../utils/assert';
// import { assMatch } from '../utils/assert'; avoid dependency
import { space, stopEvent } from '../utils/miscutils';

/*
 * Events fired on the draggable target (the source element):
ondragstart - occurs when the user starts to drag an element
ondrag - occurs when an element is being dragged
ondragend - occurs when the user has finished dragging the element

Events fired on the drop target:
ondragenter - occurs when the dragged element enters the drop target
ondragover - occurs when the dragged element is over the drop target
ondragleave - occurs when the dragged element leaves the drop target
ondrop - occurs when the dragged element is dropped on the drop target

 */


class DropInfo {
	/** @type {String} */
	dropzone;	
	/** @type {String} */
	draggable;
	// See https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent for the various x y
	/** ??x,y of the mouse -- This IGNORES where the mouse is within the draggable! */
	x;
	y;
	// also pageX, pageY
	screenX;
	screenY;
	clientX;
	clientY;
	/** @type {Number} x/left position within the dropzone */
	zoneX;
	/** @type {Number} y/top position within the dropzone */
	zoneY;

	constructor(props) {
		Object.assign(this, props);
	}
}


class DragState {
	/**
	 * @type {?String} id for drag target
	 */
	dragging;
	/**
	 * @type {DropInfo}
	 */
	drops = [];

	/**
	 * @type {String} id for drop target which we are over,
	 */
	dragover;


	// /** @type {Number} Where is the mouse/touch point on the screen (wanted for positioning during drag) */
	// screenX;
	// screenY;

	/** @type {Number} Where is the mouse/touch point on the page */
	pageX;
	pageY;

	/** @type {Number} Offset to the mouse/touch point within the dragged object */
	offsetX;
	offsetY;
 }

const dragstate = new DragState();
// for debug
window.dragstate = dragstate;


let _debug = false;
/**
 * Switch debug console logging of events on/off. Off by default.
 * @param {boolean} onOff 
 */
const setDebug = onOff => _debug = onOff;

const getDragId = e => {
	// e.dataTransfer.getData("id"
	return dragstate.dragging;
};
/**
 * 
 * @param {!Event} e 
 * @param {?String} id 
 */
const setDragId = (e, id, offsetX, offsetY) => {
	dragstate.dragging = id;
	dragstate.offsetX = offsetX;
	dragstate.offsetY = offsetY;
	// NB: touch events dont have dataTransfer, so we use an id instead to pass info
};

let _logOnceKeys = {};
setInterval(() => {
	_logOnceKeys = {};
	// console.log("logOnce - Keys cleared");
}, 10000);
/**
 * 
 * @param {...any} args If args[1]==='warning', then warn
 */
const logOnce = (...args) => {
	let key = args[0];
	if (_logOnceKeys[key]) return;
	_logOnceKeys[key] = true;
	const a1 = args[1];
	if (a1==='error') console.error(...args);
	else if (a1==='warn') console.warn(...args);
	else console.log(...args);
};

// must preventDefault to allow drag
const _onDragOver = (e, id) => {
	// TODO check for validity
	stopEvent(e);
	dragstate.dragover = id;
	let dragid = getDragId(e);
	let x = e.clientX - window.pageXOffset;
	let y = e.clientY - window.pageYOffset;
	if (_debug) console.log('onDragOver', dragstate.dragging, id, dragid, e, {x,y});
};

// must preventDefault to allow drag
const _onDragEnter = (e, id) => {
	dragstate.dragover = id;
	let dragid = getDragId(e);
	// TODO check for validity
	stopEvent(e);
	if (_debug) console.log('onDragEnter', dragstate.dragging, id, dragid, e);
};

const _onDragLeave = (e, id, onDragLeave) => {
	if (dragstate.dragover === id) dragstate.dragover = null;
	let dragid = getDragId(e);
	if (onDragLeave) onDragLeave(e, id, dragid);
};

const _onDragExit = (e, id) => {
	if (dragstate.dragover === id) dragstate.dragover = null;
	let dragid = getDragId(e);
	// TODO check for validity
	stopEvent(e);
	if (_debug) console.log('onDragExit', dragstate.dragging, id, dragid, e);
};


/**
 * Update dragstate.drops
 * @param {String} id Dropzone-ID
 * @param {?Function} onDrop (Event, DropInfo) => do-stuff

 */
const _onDrop = (e, id, onDrop) => {
	stopEvent(e);
	dragstate.dragover = null;
	let dragid = getDragId(e);
	const offsetX = dragstate.offsetX || 0;
	const offsetY = dragstate.offsetY || 0;
	console.log('onDrop', e, e.target, "id", id, dragid, dragstate.dragging);
	let elTarget = e.currentTarget || e.target;
	// dropzone rect relative to the viewport (which = page xy coords?)
	let rect = elTarget.getBoundingClientRect();
	setDragId(e, null);	
	let x = e.clientX - window.pageXOffset;
	let y = e.clientY - window.pageYOffset;
	let zoneX = e.pageX - rect.x - offsetX;
	let zoneY = e.pageY - rect.y - offsetY;
	const dropInfo = new DropInfo({dropzone:id, draggable:dragid,
		x, y,
		pageX: e.pageX, pageY: e.pageY,
		screenX:e.screenX, screenY:e.screenY,
		clientX:e.clientX, clientY:e.clientY, 
		zoneX, zoneY, zoneWidth:rect.width, zoneHeight:rect.height, 
	});
	dragstate.drops.push(dropInfo);
	e.dropInfo = dropInfo; // because it's natural to assume the event has all the data
	if (onDrop) onDrop(e, dropInfo);	
};

const _onDragStart = (e, id, onDragStart) => {	
	if (_debug) console.log('onDragStart', id, e);
	let rect = e.currentTarget.getBoundingClientRect();
	let offsetX = e.clientX - rect.x, offsetY = e.clientY - rect.y;
	setDragId(e,id,offsetX,offsetY);
	if (onDragStart) onDragStart();
};

const _onDragEnd = (e, id, onDragEnd) => {
	if (_debug) console.log('onDragEnd', id);
	dragstate.dragover = null;
	setDragId(e, null);
	if (onDragEnd) onDragEnd();
};

const _onTouchMove = (e, id) => {
	let touch = e.targetTouches[0];
	if (_debug) logOnce('touchmove', e, touch, JSON.stringify(touch));
	let $div = touch && touch.target
	// // Place element where the finger is
	if ($div && $div.style) {
		$div.style.left = touch.pageX-25 + 'px';
		$div.style.top = touch.pageY-25 + 'px';
	}
	dragstate.pageX = touch.pageX;
	dragstate.pageY = touch.pageY;
	// TODO is there a DropZone underneath?
	stopEvent(e);
};

const _onTouchEnd = (e, id, onDragEnd) => {
	console.log('touchEnd', e, e.targetTouches, e.touches, JSON.stringify(e.touches));
	// is there a DropZone underneath?
	let touch = e.changedTouches && e.changedTouches[0];
	// NB: see AdUnit visibility.js
	// // ?? element may be in a different context from us - get the relevant document and window
	// const doc = element.ownerDocument;
	// const win = doc.defaultView;	
	let pageX = touch && touch.pageX || dragstate.pageX;
	let pageY = touch && touch.pageY || dragstate.pageY;	
	const dz = getDropZone(pageX, pageY);
	// if (dz) console.log("find DropZone!", dz, dz.drop, dz.onDrop, dz.id, dz.getAttribute('id'));
	if (dz) {
		let dropzoneId = dz.getAttribute('id') || dz.id;
		let fakeE = {
			pageX, pageY,
			screenX: touch && touch.screenX,
			screenY: touch && touch.screenY,
			clientX: touch && touch.clientX,
			clientY: touch && touch.clientY,
			currentTarget: dz
		};
		_onDrop(fakeE, dropzoneId, dz.__onDrop, dz);
	}
	_onDragEnd(e, id, onDragEnd);
};

// https://mobiforge.com/design-development/html5-mobile-web-touch-events
/**
 * Wrap an element to make it draggable to a DropZone.
 * @param {?string} id This is needed -- if falsy, then this will not be draggable.
 * @param {?JSX} children This is needed -- if empty, then returns null.
 * NB: supporting falsy id and no-children is a convenience for code that wraps ad-hoc stuff in Draggable.
 */
const Draggable = ({children, id, onDragStart, onDragEnd, moveDuringDrag, className, style={}}) => {
	if ( ! id) {
		return children || null; // NB: undefined upsets React
	}
	if ( ! children) {
		return null;
	}

	assMatch(id, String);
	return (<div className={space(className,'Draggable')} style={style}
		draggable
		onDragStart={e => _onDragStart(e, id, onDragStart)}
		onDragEnd={e => _onDragEnd(e, id, onDragEnd)}
		onDragLeave={e => _onDragLeave(e, id)}
		onTouchStart={e => {
			var touch = e.targetTouches[0];
			if (_debug) console.log('touchstart', e, touch, JSON.stringify(touch));
			_onDragStart(e, id, onDragStart);
		}}
		onTouchMove={e => _onTouchMove(e, id)}
		onTouchCancel={e => {
			let touch = e.targetTouches[0];
			if (_debug) console.log('touchCancel', e, touch, JSON.stringify(touch));
			_onDragLeave(e, id);
		}}
		onTouchEnd={e => _onTouchEnd(e, id, onDragEnd)}
		>
		{children}
	</div>);
};

/**
 * 
 * @param {?Element}
 */
const getDropZone = (pageX, pageY) => {
	if ( ! pageX) {
		return null;
	}	
	let el = document.elementFromPoint(pageX, pageY);
	while(el) {
		const cs = el.getAttribute("class")
		if (cs && cs.split(" ").includes("DropZone")) {
			return el;
		}
		el = el.parentElement;
	}
}; 

/**
 * @param {!String} id identify this dropzone in the dragstate / drop info
 * @param {?Function} onDrop Called if there is a drop here. (e, dropInfo) => do-stuff
 */
const DropZone = ({id, children, onDrop, canDrop, className, style}) => {
	if ( ! id) {
		console.error("DropZone without an id - drops might not work");
	}
	// active?
	let dragover;
	if (id && dragstate.dragover===id) {
		if (canDrop) {
			let ok = canDrop(dragstate.dragging, id);
			if (ok) dragover = "dragover"
		} else {
			dragover = "dragover";
		}
	}
	// dropzone with handlers
	return (<div className={space(className, "DropZone", dragover)} style={style}
		id={id}
		ref={el => {
			// NB: el can be null - see https://reactjs.org/docs/refs-and-the-dom.html#caveats-with-callback-refs
			if ( ! el) return;				
			// pass on the onDrop function - so that touchEnd can find it
			el.__onDrop = onDrop;
		}}
		onDragOver={e => _onDragOver(e, id)}
		onDragEnter={e => _onDragEnter(e,id)}
		onDragExit={e => _onDragExit(e,id)}
		onDrop={e => _onDrop(e, id, onDrop, this)}
		>
		{children}
	</div>);
};

export {
	Draggable,
	DropZone,
	dragstate,
	DropInfo,
	setDebug
}
