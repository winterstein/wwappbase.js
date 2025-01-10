import React from 'react';
import { space, randomPick } from '../utils/miscutils';

/**
 * TODO standardise use of icons and emojis
 */

/**
 * See https://unicode-table.com/
 * https://www.unicode.org/emoji/charts/full-emoji-list.html
 */
const EMOJI = {
	bug: "🐛", //🪲🐞
	camera: "📷",
	caretup:"△", // ‸⋀⋁△▽▵▾▿
	caretdown:"▽",
	circlearrow: "⟳",
	clipboard: "📋",
	genie: "🧞",
	globe: "🌍",
	help: "?", // use the normal q-mark - though we also have ❓？
	hourglass: "⏳",
	info: "ⓘ", // ℹ or 🛈
	intray: "📥",
	link:"🔗",
	memo: "📝",
	outtray: "📤",
	plus: "⨁", // ⊕
	reload: "↻", // clockwise open circle arrow ♺⥁
	scroll: "📜",
	search: "🔍",
	seedling: "🌱",
	settings: "⚙", // gear
	stopwatch: "⏱️",
	thumbsup: "👍",
	thumbsdown: "👎",
	tick: "✔",
	trashcan: "🗑", //&#x1f5d1;
	".txt":"🖹",
	warning: "⚠",
	mobile: "📱",
	desktop: "💻", // or 🖳	
	x: '✕',
	yinyang: "☯️",
	popout: '⇱',
};


const SVG = {
	// Rights with Good-Loop (5-minute inkscape sketches by RM who hereby releases etc)
	share: <svg fill="currentColor" viewBox="0 0 100 100" width="1em" height="1em"><path d="M31.125 39a17.5 17.5 0 100 22l34.5 17.2a17.5 17.5 0 103.35-6.7l-34.5-17.2a17.5 17.5 0 000-8.5l34.5-17.2a17.5 17.5 0 10-3.35-6.7Z"/></svg>,
	copy: <svg fill="currentColor" viewBox="0 0 100 100" width="1em" height="1em"><path d="M40 0V25H0V100H60V75H100V20L80 0H40ZM45 5H78V22H95V70H45V5ZM5 30H40V75H55V95H5V30Z" /></svg>,
	download: <svg fill="currentColor" viewBox="0 0 100 100" width="1em" height="1em"><path d="m5 60v25h90v-25h-10v15h-70v-15z"/><path d="m42.5 15v35h-10l17.5 17.5 17.5-17.5h-10v-35z"/></svg>,
	edit: <svg fill="currentColor" viewBox="0 0 100 100" width="1em" height="1em"><path d="m80 51v39h-70v-80h48l10-10h-68v100h90v-59zm-33-14-5 21 21-5 27-27-16-16zm45-13 5-5c2-2 2-6 0-8l-8-8c-2-2-6-2-8 0l-5 5z" /></svg>
};


/**
 * Hack: list external SVG icons here.
 * We should prob standardise on an icon font - see https://getbootstrap.com/docs/5.0/extend/icons/#bootstrap-icons
 */
const ICONS = {
	// download: "https://icons.getbootstrap.com/assets/icons/download.svg"
};


/**
 * Unified interface for rendering various emoji, SVG icons, etc by name
 * @param {Object} p
 * @param {string} [p.className] className passthrough
 * @param {string} p.name camera|trashcan|memo etc
 * @param {string} [p.color] black|white|grey
 * @param {string} [p.size] xs|sm|lg|xl
 */
function Icon({name,size="sm",className,color,...props}) {
	if (name==="spinner") name = randomPick("yinyang hourglass stopwatch genie circlearrow".split(" "));
	if (EMOJI[name]) {
		if (color && ! 'black white grey success info warning danger'.includes(color)) {
			console.warn("Icon.jsx color not directly supported: "+color+" Icons can only reliably use a few set colors cross-device.");
		}
		// TODO test for character support -- try this https://stackoverflow.com/a/63520666
		// see Icon.less for emoji-X 
		return <span className={space("emoji", color&&"emoji-"+color, size&&"logo-"+size, className)} dangerouslySetInnerHTML={{__html:EMOJI[name]}} {...props} />;
	}
	if (SVG[name]) {
		return SVG[name]; // ??color size as style
	}
	let url;
	// if (name === C.app.id) {
	// 	url = C.app.logo;
	// }
	// Social media
	if ('twitter facebook instagram chrome edge google-sheets github linkedin safari'.indexOf(name) !== -1) {
		url = '/img/gl-logo/external/' + name + '-logo.svg';
		if (name === 'instagram') url = '/img/gl-logo/external/instagram-logo.png'; // NB (Instagram's mesh gradient can't be done in SVG)
	}
	if ( ! url) url = ICONS[name];

	let classes = 'rounded logo' + (size ? ' logo-' + size : '');
	if (url) {
		return <img alt={name} data-pin-nopin="true" className={classes} src={url} {...props} />;
	}
	console.warn("No icon for "+name);
	return null;
}

export default Icon;
