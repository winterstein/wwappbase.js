import React, { useState, useEffect } from 'react';

import { range } from 'lodash';
import { Pagination, PaginationItem, PaginationLink } from 'reactstrap';

import { space } from '../utils/miscutils';

import '../style/Pager.less';


/**
 * Can this page button be hidden?
 * @param {Number} page Number for page button in question
 * @param {Number} current Currently-focused page
 * @param {Number} pageCount Total pages
 * @returns {boolean}
 */
const isOptional = (page, current, pageCount) => {
	// The "first, last, current, one either side, and only when it reduces the item count" rule
	// means no buttons will ever be skipped when there are 4 pages or fewer.
	// Also at 4 pages the "only hide 2 if 3 is optional" and "only hide N-1 if N-2 is optional"
	// checks overlap and can recurse infinitely alternately checking 2 and 3...
	if (pageCount < 5) return false;
	// Special buttons always displayed
	if (typeof page !== 'number') return false;
	// First, last, current, and 1 button either side of current are always shown no matter what.
	if ([1, current - 1, current, current + 1, pageCount].includes(page)) return false;
	// 2 is only optional if 3 is as well - since removing 2 introduces a "skipped items"
	// dummy button, 3 must be removed at the same time to actually reduce overall width.
	if (page === 2 && !isOptional(3, current, pageCount)) return false;
	// N-1 is only optional if N-2 is as well, for the same reason.
	if (page === (pageCount - 1) && !isOptional(pageCount - 2, current, pageCount)) return false;
	// Everything else can be cut.
	return true;
}


/**
 * Construct a list of props objects for the pager buttons.
 * @param {Object} baseProps These will all be passed down to the buttons
 * @param {Number} pageCount Total pages for this pager
 */
const initButtonProps = (baseProps) => {
	const { pageCount } = baseProps;

	const propsList = range(1, pageCount + 1).map(page => ({
		...baseProps,
		key: page,
		target: page,
	}));

	// Insert dummy "elements skipped here" buttons
	propsList.splice(1, 0, { key: 'skip-low', dummy: true, ...baseProps });
	propsList.splice(pageCount - 1, 0, { key: 'skip-high', dummy: true, ...baseProps });

	// Insert prev/next
	propsList.unshift({ key: 'prev', previous: true, ...baseProps });
	propsList.push({ key: 'next', next: true, ...baseProps });
	
	propsList.forEach(p => (p['data-key'] = p.key)); // Duplicate item key to data-attr so it's retrievable from rendered elements

	return propsList;
};


const renderable = (key, toHide, pageCount) => {
	if (toHide[key]) return false; // Explicitly hidden
	// Is this a "some buttons skipped" marker?
	let skippedIndex = { 'skip-low': 2, 'skip-high': pageCount - 1 }[key];
	if (!skippedIndex) return true;
	// It is! If the relevant buttons were hidden, we need to keep the marker.
	return !!toHide[skippedIndex];
}


/**
 * Generates a Reactstrap <Pagination> and adjusts the set of displayed page buttons to available space.
 *
 * @param {Object} props All passed down to PageBtn
 */
function Pager({pageCount, current, setPage, ...baseProps}) {
	if (!pageCount || pageCount <= 1) return null; // No pages = no pager.

	const [pagerEl, setPagerEl] = useState(); // The element containing all the buttons
	const [buttonProps, setButtonProps] = useState([]); // Specs for the button list (includes all possible buttons for pagecount)
	const [measured, setMeasured] = useState(false); // Button list has been culled for width & is ready to show.

	const pagerWidth = pagerEl?.getBoundingClientRect().width; // How wide is the container?

	// Reset button props (removing widths) when pagecount or container width changes.
	useEffect(() => {
		setButtonProps(initButtonProps({pageCount, ...baseProps}));
		setMeasured(false); // Measurements invalidated, so redo them.
	}, [pageCount]);

	// Measure button elements and store width of each on corresponding props object
	useEffect(() => {
		if (!pagerWidth || measured) return; // Pager must be in DOM, measurable, and not yet measured
		const buttonEls = Array.from(pagerEl.querySelectorAll('li.page-item'));
		const nextButtonProps = buttonProps.map(bProps => {
			// Find the DOM element corresponding to this props object...
			const buttonEl = buttonEls.find(el => el.dataset.key === `${bProps.key}`);
			const { width } = buttonEl.getBoundingClientRect();
			return { ...bProps, width }; // ...and record its width
		});
		setButtonProps(nextButtonProps);
		setMeasured(true);
	}, [measured, pagerWidth]);

	// Not measured yet? Render all buttons.
	let filteredProps = buttonProps;
	if (measured) {
		// We may need to hide some buttons to fit the pager inside the available space.
		const toHide = {};

		// Which buttons are hideable?
		const hideables = buttonProps.filter(p => {
			// Always keep prev, next, first, last, current, and two around current.
			return isOptional(p.key, current, pageCount);
		}).toSorted((a, b) => {
			// Sort furthest from current page to end - we'll hide these first.
			return (Math.abs(current - a.key) - Math.abs(current - b.key));
		}).map(p => p.key);

		while (true) {
			// How much horizontal space do all the not-yet-hidden buttons occupy?
			const totalWidth = buttonProps.filter(p => renderable(p.key, toHide, pageCount))
				.reduce((acc, p) => (acc + p.width), 0);
			if (totalWidth < pagerWidth) break; // Target hit, we're finished.
			if (!hideables.length) break; // Nothing else can be hidden, we're finished.

			// We can and should remove something - what's next on the list?
			const nextHideable = hideables.pop();
			toHide[nextHideable] = true;
			// Always remove 2 and 3 together, always remove N-1 and N-2 together
			const companion = { 2: 3, [pageCount - 1]: pageCount - 2 }[nextHideable];
			if (companion) {
				hideables.splice(hideables.indexOf(companion), 1);
				toHide[companion] = true;
			}
		}

		filteredProps = buttonProps.filter(p => renderable(p.key, toHide, pageCount));
	}

	// Wrap the <Pagination> in something we can give a ref, so we can measure the contents
	return <div className={space('pagination-controls', measured && 'measured')} ref={setPagerEl}>
		<Pagination>
			{filteredProps.map(bProps => <PageBtn current={current} setPage={setPage} {...bProps} />)}
		</Pagination>
	</div>;
}


/**
 * Abstracts out boilerplate for generating <PaginationItem>s
 *
 * @param {Object} p
 * @param {Function} p.setPage On-click for each button. Takes a target page number.
 * @param {Number} p.target Page the link should go to
 * @param {Number} p.current Current page number
 * @param {Number} p.pageCount Total page count
 */
function PageBtn({setPage, target, current, pageCount, dummy, width, ...linkProps}) {
	const itemProps = {};

	// Shift all data-attrs from linkProps to itemProps
	Object.entries(linkProps).forEach(([k, v]) => {
		if (!k.match(/^data-/)) return;
		itemProps[k] = v;
		delete linkProps[k];
	});


	let text = null;
	if (dummy) {
		itemProps.disabled = true;
		text = '…';
	} else if (linkProps.previous) {
		target = current - 1;
		itemProps.disabled = target < 1;
	} else if (linkProps.next) {
		target = current + 1;
		itemProps.disabled = target > pageCount;
	} else {
		text = target;
		itemProps.active = (target === current);
	}

	return <PaginationItem {...itemProps}>
		<PaginationLink {...linkProps} onClick={() => setPage(target)}>{text}</PaginationLink>
	</PaginationItem>;
}


export default Pager;
