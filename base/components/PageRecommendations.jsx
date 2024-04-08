import React, { useState, useEffect } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, CardImg, Modal, ModalBody, ModalHeader, Table } from 'reactstrap';

import { proxy, transferTotal, typeBreakdown } from '../utils/pageAnalysisUtils';
import StyleBlock from './StyleBlock';
import { nonce } from '../data/DataClass';
import C from '../CBase';
import { bytes, space } from '../utils/miscutils';
import Misc from './Misc';
import { A } from '../plumbing/glrouter';
import { getBestRecompression, shortenName } from './creative-recommendations/recommendation-utils';

/**
 * A short, readable form for URLs which can be unmanageably long.
 * Displays "[page_filename.html] on www.domain.com" - filename part links to full URL,
 * and entire element has full URL as hover popover.
 * @param {object} p
 * @param {string} p.url The URL to display
 * @returns {JSX.Element|null}
 */
export function FriendlyURL({url}) {
	const [{shortName, hostname}, setUrlObj] = useState({});
	useEffect(() => {
		const {hostname} = new URL(url);
		setUrlObj({shortName: shortenName(url), hostname});
	}, [url]);

	return shortName ? <><A href={url} title={url}>{shortName}</A> on {hostname}</> : null;
}


/** Note that a resource is loaded but not used */
function UnusedWarning({spec}) {
	return spec.unused ? <div>
		This resource is loaded, but does not appear to be used by the creative.
	</div> : null;
};


/**
 * One row for a SizeComparison
 * @param {Object} p
 * @param {Transfer} spec Transfer object augmented with recommendation info
 * @param {Object} best The best candidate recompression/replacement for this file
 * @param {boolean} only True if this isn't part of a comparison
 */
function ComparisonRow({spec, best, only}) {
	let { filename, url, isSubstitute } = spec;
	let b = spec.bytes; // avoid name clash with bytes()
	let desc = 'Original';

	if (best) {
		url = best.url;
		b = best.bytes;
		desc = isSubstitute ? 'Replacement' : 'Optimised';
	} else if (only) {
		desc = filename;
	}

	return <div className={space('comparison-row', best ? 'optimised' : 'original')}>
		<div className="desc"><C.A target="_blank" href={url} title={url} download={filename}>{desc}</C.A></div>
		<div className="size">{bytes(b)}</div>
	</div>
}


/** Compare the size of a resource to its optimised equivalent. */
function SizeComparison({spec, best}) {
	const optBytes = best?.bytes || spec.bytes; // No "best recompression" = 0% smaller
	// How much smaller?
	const improvement = (1 - (optBytes / spec.bytes)) * 100;

	return <div className="size-comparison">
		<ComparisonRow spec={spec} only={!best} />
		{best ? <>
			<ComparisonRow spec={spec} best={best} />
			<div className="improvement">
				<span className="percent">{improvement.toFixed(1)}%</span>
				{` smaller (${bytes(spec.bytes - optBytes)})`}
			</div>
		</> : null}
	</div>;
}


const baseCharacterSet =
'abcdefghijklmnopqrstuvwxyz\n' +
'ABCDEFGHIJKLMNOPQRSTUVWXYZ\n' +
'1234567890!"#$%&\'()*+,-./:\n' +
';<=>?@[\]^_`{|}~';

/**
 * Show a table of basic Latin-1 characters & punctuation and mark which are unused
 * @param {string} characters The set of characters to display on the table
 */
function ShowCharacters({characters}) {
	const [charEls, setCharEls] = useState(null);
	useState(() => {
		setCharEls(baseCharacterSet.split('').map(char => {
			if (char === '\n') return <br />;
			const unused = (characters.indexOf(char) < 0) && 'unused'
			return <span className={space('char', unused)}>
				{char}
			</span>;
		}));
	}, [characters]);

	return <div className="character-set">
		{charEls}
	</div>;
};


/** Preview the font (assuming there is one) contained in one augmented Transfer */
function FontPreview({spec}) {
	const [fontFamily] = useState(`font-${nonce()}`); // nonce() can start with numerals, which isn't a legal font-family, so prefix

	const { url, filename, name, font } = spec;
	const fontWeight = font ? font.weights.find(w => !!w) : 500; // default 500/normal for unused

	return <>
		<StyleBlock>{`@font-face { font-family: "${fontFamily}"; src: url("${proxy(url)}"); }`}</StyleBlock>
		<div className="preview font-preview" style={{ fontFamily, fontWeight }} title={name || filename}>
			<Misc.FixBreak text={name || filename} />
		</div>
	</>
}


/**
 * Additional details on usage and optimisations performed on a font
 * TODO Also show alternate formats and unsubsetted versions from the recompression set
 */
function FontRecDetails({spec, best}) {
	const [open, setOpen] = useState(false);
	const toggle = () => setOpen(a => !a);

	const { filename, font } = spec;

	let desc = [];
	if (!filename.match(/\.woff2/)) {
		const origFormat = filename.match(/\.[^.]+$/)[0];
		desc.push(<li key="conversion">
			This font has been converted from <b>{origFormat}</b> to <b>.woff2</b>, which offers the most efficient compression currently available.
		</li>);
	}
	if (font?.characters) {
		desc.push(<li key="subset">
			This font has been optimised by removing characters which are never used in the creative:
			<ShowCharacters characters={font.characters} />
		</li>);
	}

	return <>
		<Button onClick={toggle}>Details</Button>
		<Modal isOpen={open} className="recommendation-details-modal font-details" toggle={toggle}>
			<ModalHeader toggle={toggle}>Font Optimisation</ModalHeader>
			<ModalBody>
				<div className="text-center my-4">
					<FontPreview spec={spec} />
				</div>
				<ul>
					{desc}
				</ul>
			</ModalBody>
		</Modal>
	</>
}


/** Show the optimisations performed on one font file */
export function FontRecommendation({spec, best}) {
	return <Card className="opt-rec font-rec">
		<CardHeader>Font</CardHeader>
		<CardBody className="p-2">
			<div className="my-1">
				<FontPreview spec={spec} />
			</div>
			<SizeComparison spec={spec} best={best} />
			<UnusedWarning spec={spec} />
			<FontRecDetails spec={spec} best={best} />
		</CardBody>
	</Card>;
}

/**
 * Convenience for a button which toggles when pressed and released.
 * Uses pointer capture so release fires when the mouse is released, even if the pointer has moved off.
 * TODO Move to Misc?
 */
function HoldButton({onPress, onRelease, Tag = 'button', children, ...props}) {
	const allProps = {
		onPointerDown: e => {
			e.target.setPointerCapture(e.pointerId);
			onPress(e);
		},
		onPointerUp: e => {
			onRelease(e);
			e.target.releasePointerCapture(e.pointerId);
		},
		...props
	};
	return <Tag {...allProps}>{children}</Tag>;
}


/** Extract the extension from a filename. TODO Move to a utils file rather than this components file */
const fileType = filename => {
	const extMatch = filename.match(/\.[^.]+$/);
	if (extMatch) {
		let ft = extMatch[0];
		if (ft.indexOf("?") !== -1) { // ??Let's move this into the regex above. But just before release, I want dead-safe code.
			ft = ft.substring(0, ft.indexOf("?"));
		}
		return ft;
	}
	return '(none)';
}


/** Additional details on usage and optimisations performed on an image. 
 * @param {TODO doc data type} spec 
*/
function ImgRecDetails({spec, best}) {
	const [open, setOpen] = useState(false);
	const [showOriginal, setShowOriginal] = useState(false);
	const toggle = () => setOpen(a => !a);

	// No details to show for images that analysis suggests are unused.
	if (spec.unused) return null;

	// TODO controls for retina, no-scale, etc
	// - can we support changing compression params without losing all data & returning to main screen?

	let { url, imgEl } = spec; // NB Original URL will be proxied when previewing to avoid adblock and Firefox Enhanced Tracking Protection
	let { url: optUrl } = best;
	// 3 sets of dimensions!
	// Size of originally analysed HTML element - the image will be previewed at this size.
	let { width: displayWidth, height: displayHeight } = spec.elements[0];
	let { naturalWidth: width, naturalHeight: height } = imgEl; // Size of original image
	let { width: newWidth, height: newHeight } = best; // Size of resized image
	const imgStyle = { maxWidth: displayWidth, maxHeight: displayHeight };

	const desc = [];
	const origType = fileType(url);
	const optType = fileType(optUrl);
	if (origType !== optType) {
		desc.push(<li key="conversion">
			This image has been converted from <b>{origType}</b> to <b>{optType}</b> to improve compression efficiency.
		</li>);
	}

	if (imgEl && (newWidth < width || newHeight < height)) {
		desc.push(<li key="scaled">
			This image has been scaled from its original size of <b>{width}x{height}</b> to the size it appears on-screen, <b>{newWidth}x{newHeight}</b>.
		</li>);
	}

	return <>
		<Button onClick={toggle}>Details</Button>
		<Modal isOpen={open} className="recommendation-details-modal image-details" toggle={toggle}>
			<ModalHeader toggle={toggle}>Image Optimisation</ModalHeader>
			<ModalBody>
				<div className="img-comparison-container">
					<div className="img-comparison">
						<img className="original" style={imgStyle} src={proxy(url)} />
						<img className="optimised" style={{...imgStyle, opacity: showOriginal ? 0 : 1}} src={optUrl} />
					</div>
					<div className="version-indicator">{showOriginal ? 'Original' : 'Optimised'}</div>
					<div className="preview-toggle">
						<HoldButton
							Tag={Button}
							onPress={() => setShowOriginal(true)}
							onRelease={() => setShowOriginal(false)}
						>
							Show Original
						</HoldButton>
					</div>
				</div>
				<ul>{desc}</ul>
			</ModalBody>
		</Modal>
	</>
};



/** Show the optimisations performed on one image file */
export function ImgRecommendation({spec, best}) {
	let { url } = spec;
	url = proxy(url); // Circumvent adblock and Firefox Enhanced Tracking Protection

	return <Card className="opt-rec img-rec">
		<CardHeader>Image</CardHeader>
		<div className="img-preview-container p-1">
			<img className="preview img-preview" src={url} />
		</div>
		<CardBody className="p-2">
			<SizeComparison spec={spec} best={best} />
			<UnusedWarning spec={spec} />
			<ImgRecDetails spec={spec} best={best} />
		</CardBody>
	</Card>;
}


/** Show the optimisations performed on one GIF file */
export function GifRecommendation({spec, best}) {
	let { url } = spec;
	url = proxy(url); // Circumvent adblock and Firefox Enhanced Tracking Protection

	return <Card className="opt-rec gif-rec">
		<CardHeader>GIF</CardHeader>
		<img className="preview gif-preview p-1" src={url} />
		<CardBody className="p-2">
			<SizeComparison spec={spec} best={best} />
			<UnusedWarning spec={spec} />
			<ImgRecDetails spec={spec} best={best} />
		</CardBody>
	</Card>;
}


/** Show the optimisations performed on one SVG file */
export function SvgRecommendation({spec, best}) {
	let { url } = spec;
	url = proxy(url); // Circumvent adblock and Firefox Enhanced Tracking Protection

	return <Card className="opt-rec svg-rec">
		<CardHeader>SVG Image</CardHeader>
		<div className="img-preview-container p-1">
			<img className="preview img-preview" src={url} />
		</div>
		<CardBody className="p-2">
			<SizeComparison spec={spec} best={best} />
			<UnusedWarning spec={spec} />
		</CardBody>
	</Card>;
}

/** Show the optimisations performed on one JavaScript file */
export function ScriptRecommendation({spec, best}) {
	const { filename } = spec;

	return <Card className="opt-rec script-rec">
		<CardHeader>JavaScript</CardHeader>
		<CardBody className="p-2">
			<p className="preview script-preview my-1">{filename}</p>
			<SizeComparison spec={spec} best={best} />
			<UnusedWarning spec={spec} />
			{spec?.message}
		</CardBody>
	</Card>;
}


/** Special case for "There's nothing for us to do here" */
export function NoRecommendation({spec}) {
	return <Card className="opt-rec no-rec">
		<CardHeader title={spec.message}>No Reduction</CardHeader>
		<CardBody className="p-2">
			<SizeComparison spec={spec} />
		</CardBody>
	</Card>;
};


const recComponents = {
	image: ImgRecommendation,
	font: FontRecommendation,
	gif: GifRecommendation,
	svg: SvgRecommendation,
	script: ScriptRecommendation
};


/** Use the correct recommendation card type for an augmented Transfer object.
 * 
 * TODO doc spec, props please
 * spec is returned from DataStore.getValue(processedRecsPath({tag}, manifest));
 * which is set by generateRecommendations()
 * 
*/
export function Recommendation({spec, ...props}) {
	// The spec may be marked as having a significant reduction, but have a recompression candidate
	// that can't be used under current settings (eg webp image with "can't use webp" set)
	const best = getBestRecompression(spec);
	const RecComponent = (best && best.significantReduction) ? recComponents[spec.type] : NoRecommendation;
	if (!RecComponent) return null;
	return <RecComponent spec={spec} best={best} {...props} />;
};


/**
 * Breakdown of data types on a page.
 * @param {object} p
 * @param {object} p.manifest PageManifest
 * @param {boolean} [p.separateSubframes] True to roll all transfers inside sub-frames into one "sub-frame content" line
 */
export function TypeBreakdown({manifest, separateSubframes}) {
	if (!manifest) return null;
	const [breakdown, setBreakdown] = useState();
	useEffect(() => setBreakdown(typeBreakdown(manifest, separateSubframes)), [manifest]);
	if (!breakdown) return null;

	return (
		<div className="type-breakdown">
			<div className="breakdown-bar">
				{breakdown.map(({title, fraction, color}) => (
					<div className="bar-segment"
						title={title}
						style={{flexBasis: `${fraction * 100}%`, backgroundColor: color}}
					/>
				))}
			</div>
			<Table className="breakdown-table" size="sm">
				<thead>
					<tr><th /><th>Type</th><th>Bytes</th><th>% Total</th></tr>
				</thead>
				<tbody>
					{breakdown.map(({color, title, bytes, fraction = 0}) => <tr key={title}>
						<td><div className="breakdown-key" style={{backgroundColor: color}} /></td>
						<td>{title}</td>
						<td>{bytes}</td>
						<td>{(fraction * 100).toFixed(1)}%</td>
					</tr>)}
				</tbody>
			</Table>
		</div>
	);
}


/** Preview of one document / sub-frame PageManifest */
export function SubFrameInfo({frame, onClick, className, ...props}) {
	const { screenshot, url, width, height } = frame;
	const childCount = frame.frames?.length || 0;

	return <Card className={space('sub-frame', className)} {...props}>
		<CardHeader><FriendlyURL url={url} /></CardHeader>
		{screenshot ? <CardImg src={screenshot} /> : null}
		<CardBody className="p-2">
			<div>Frame size: {width} × {height}</div>
			<div><strong>{transferTotal(frame)}</strong> bytes </div>
			<div>
				{childCount ? <Badge size="sm" color="secondary" title={`Contains ${childCount} sub-frame${childCount > 1 ? 's' : ''}`}>F</Badge> : null}
				<Button size="sm" color="secondary" className="pull-right" onClick={() => onClick(frame)}>Enter Frame</Button>
			</div>
		</CardBody>
	</Card>;
}

const frameSortFn = (a, b) => {
	let aArea = a.extra ? a.extra.height * a.extra.width : 0;
	let bArea = b.extra ? b.extra.height * b.extra.width : 0;
	return bArea - aArea;
}

/** Returns an array of clickable frame previews to navigate into the sub-document tree of a PageManifest */
export function FrameNavigator({manifest, setFrame, FrameComponent = SubFrameInfo, childProps}) {
	if (!manifest || !manifest.frames.length) return null;

	// Sort frames by on-screen size - should put most relevant first.
	useEffect(() => { manifest.frames.sort(frameSortFn); }, [manifest]);

	return manifest.frames.map(f => <FrameComponent key={f.url} frame={f} onClick={setFrame} {...childProps} />);
};