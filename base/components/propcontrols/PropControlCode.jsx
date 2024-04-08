import React, { useEffect, useRef, useState } from 'react';
// TODO Maybe auto-load this from CDN like with Beautify?
import Prism from 'prismjs';
Prism.manual = true; // Suppress Prism auto-highlighting

import { registerControl } from '../PropControl';
import { setInputValue } from '../../utils/miscutils';

// import '../../style/prism-dark.less';
import '../../style/prism-tomorrow.less';
import '../../style/PropControls/PropControlCode.less';
import { Button } from 'reactstrap';




/** Unused: verifies the line splitter's ability to work with nested tokens */
const multilineTest = [
	'This is a text token\n',
	{ type: 'important', content: ['Multi-string text token 1 ', 'Multi-string text token 2 ', 'Multi-string text token 3'] },
	'\n',
	{ type: 'property', content: 'Single string which spans multiple lines\nContinuation of multiline string' },
	'\n',
	{ type: 'comment', content: [
		'Comment token 1',
		{ type: 'selector', content: 'Comment+selector nested token' },
		' ',
		{ type: 'property', content: 'Comment+property nested MULTILINE token line 1\nComment+property nested MULTILINE token line 2' },
		'\n',
		'Comment token end line 1\nComment token end line 2',
	]},
];


/**
 * Where a token's content is an array, e.g. ['\nLine1\nLine2', 'MoreLine2\n', 'Line3\n']
 * splitToken yields an array of arrays where:
 * - every element boundary in an INNER array is a line break
 * - but the OUTER element boundaries are just token breaks
 * e.g. [['', 'Line1', 'Line2'], ['MoreLine2', ''], ['Line3', '']]
 * Regroup the array so that's reversed - outer boundaries are line breaks, inners are token breaks.
 * e.g. [[''], [Line1], ['Line2', 'MoreLine2'], ['', 'Line3'], ['']]
*/
const regroupLines = (notLines) => (
	notLines.reduce((lines, tknLines) => {
		if (!tknLines.length) return lines; // Ignore empty tokens
		if (!lines.length) lines.push([]); // Make sure there's a container to start first line
		// attach first item to end of current line
		lines.lastItem.push(tknLines[0]);
		// remaining items are all additional lines
		for (let i = 1; i < tknLines.length; i++) { lines.push([tknLines[i]]); }
		return lines;
	}, [])
);


/**
 * Process a Prism.js token (or array thereof) and:
 * - Split the token stream on every newline
 * - Replace all non-whitespace characters with non-breaking spaces
 * (so layout engine wraps lines the same way it would the original text)
 * So e.g. { type: "x", content: { type: "y", content: "Line 1\n\tLine 2" } }
 * ...becomes [
 *   { type: "x", content: { type: "y", content: "      " } },
 *   { type: "x", content: { type: "y", content: "\t      " } }
 * ]
 * Q: Why do this and not just put the tokens in a preformatted block?
 * A: Well, no reason right now - but this parsing can enable things like <ol> line numbering with a little more poking.
 * @param {Prism.Token|Prism.Token[]} tokens As output from Prism.tokenize
 * @returns {Prism.Token[]} Split and regrouped into an array of lines
 */
const splitTokenLines = (tokens) => {
	// Trivial case: no input, empty output.
	if (!tokens) return [];
	// Base case: split string on newline character (LF or CRLF - can use /\r\n|\r|\n/ if we somehow need to support MacOS 9)
	// 'Hello\nWorld\n' --> ['Hello', 'world', ''] --> ['     ', '     ', '']
	// Don't trim off empty strings! They signify leading and trailing newlines.
	if (typeof tokens === 'string') return tokens.split(/\r?\n/).map(s => s.replace(/\S/g, '\u00A0'));

	// Array case: Split all tokens into sets of lines, then regroup to merge non-linebreak token boundaries.
	if (tokens.map) return regroupLines(tokens.map(splitTokenLines));

	// Recursive case: Process token's content to lines, then wrap each line in a copy of the token.
	return splitTokenLines(tokens.content).map(content => ({...tokens, content}));
};


/** Recursively render a Prism.js Token or array of tokens to <span>s */
function RenderToken({ token }) {
	if (typeof token === 'string') return token;
	if (token.map) return token.map((tkn, i) => <RenderToken key={i} token={tkn} />);
	return <span className={`token ${token.type}`}><RenderToken token={token.content} /></span>;
}


/** URL to language-specific Beautify bundle */
const beautifyUrl = lang => `https://cdnjs.cloudflare.com/ajax/libs/js-beautify/1.14.11/beautify${lang}.min.js`;


/** Languages Beautify can autoformat for us */
const beautifyUrls = {
	js: beautifyUrl(''),
	css: beautifyUrl('-css'),
	html: beautifyUrl('-html')
};


/**
 * Automatically format code using beautify.js
 * Loads the library from CDN on first run to avoid yet another dependency in the bundle.
 * @param {String} lang "js", "css", "html"
 * @param {String} text Input code. JS and CSS will have all linebreaks collapsed and rebuilt.
 * @param {Function} callback Called with the formatted text when done (may be inline or async depending on whether library is already loaded)
 */
const formatCode = (lang, text, callback) => {
	const scriptUrl = beautifyUrls[lang];
	let beautifyScript = document.querySelector(`script[src="${scriptUrl}"]`);
	if (!beautifyScript) {
		beautifyScript = document.createElement('script');
		beautifyScript.src = scriptUrl;
		document.head.appendChild(beautifyScript);
	}
	// Which Beautify function do we call?
	const fnName = `${lang}_beautify`;

	const doFormat = () => {
		const options = { indent_with_tabs: true, css: { selector_separator_newline: false, preserve_newlines: false } };
		// HTML linebreaks are important so we preserve them - CSS/JS we collapse and rebuild
		text = (lang === 'html') ? text : text.replaceAll(/\r?\n/g, ' ');
		const formatted = window[fnName](text, options);
		callback(formatted)
	};
	if (!window[fnName]) {
		beautifyScript.addEventListener('load', doFormat);
	} else {
		doFormat();
	}
};


/**
 * Basically just a <textarea> - but with two extra features:
 * - A non-interactable overlay which paints syntax highlighting on the text
 * - A button for auto-formatting the text per JS, CS or HTML rules
 * @param {Object} p
 * @param {String} p.lang Language to highlight as - eg. "css", "js", "html"
*/
const PropControlCode = ({ lang, onChange, onKeyDown, rawValue }) => {
	const inputRef = useRef(); // The textarea
	const highlightRef = useRef(); // The highlighting overlay

	// When text changes, regenerate highlighting overlay
	const [tokenLines, setTokenLines] = useState([]);
	useEffect(() => {
		const tokens = Prism.tokenize(rawValue || '', Prism.languages.css);
		setTokenLines(splitTokenLines(tokens));
	}, [rawValue]);

	// Event handlers for <textarea> input
	const inputEvents = {
		onChange,
		// Match scrolling between textarea and highlighter
		onScroll: () => {
			if (!inputRef.current || !highlightRef.current) return;
			highlightRef.current.scrollLeft = inputRef.current.scrollLeft;
			highlightRef.current.scrollTop = inputRef.current.scrollTop;
		},
		// Catch "Tab" keypresses and insert a \t instead of selecting next interactable element
		onKeyDown: (e) => {
			if (onKeyDown && !onKeyDown(e)) return; // Don't handle if custom handler returns false
			if (e.key !== 'Tab') return;
			if (!inputRef.current) return;
			e.preventDefault();
			// Clean way: use fake user-input API (also pushes onto the undo stack)
			if (!document.execCommand('insertText', false, '\t')) {
				// Fallback (doesn't support undo): Overwrite selection, trigger onChange, push caret forward by 1.
				const { selectionStart: ss, selectionEnd: se, value } = inputRef.current;
				setInputValue(inputRef.current, value.slice(0, ss) + '\t' + value.slice(se));
				inputRef.current.setSelectionRange(ss + 1, ss + 1);
			}
		}
	};

	// Is this a language we can auto-format?
	const doFormat = beautifyUrls[lang] && (() => {
		const callback = formatted => setInputValue(inputRef.current, formatted);
		formatCode(lang, rawValue, callback);
	});

	return <>
		<pre className={`language-${lang}`}>
			<code className={`language-${lang}`}>
				<textarea value={rawValue} ref={inputRef} {...inputEvents} rows={10} />
				<div className="highlighter" ref={highlightRef}>
					{tokenLines.map((line, i) => (
						// The leading <wbr> is a zero-width space that ensures empty lines still occupy height
						<div className="line" key={i}><wbr /><RenderToken token={line} /></div>
					))}
				</div>
			</code>
		</pre>
		{doFormat && (
			<Button className="mt-1 pull-right" onClick={doFormat}>
				Clean up formatting
			</Button>
		)}
	</>;
};


registerControl({
	type: 'code',
	$Widget: PropControlCode,
});


export default {};
