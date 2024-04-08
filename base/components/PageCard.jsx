
import React from 'react';
import { space } from '../utils/miscutils';
import BG from './BG';

/**
 * To avoid re-inventing the wheel with slightly different styling each time -- THIS is our way to implement 
 * a card which is a slice of a page.
 * 
 * Title: Use an h2 within the card children
 * 
 * @param {Object} p
 * @param {?string} p.className This applies to the top-level of the card. Don't use it for e.g. flex, as that will mess with the cards layout.
 */
const PageCard = ({backgroundImage, backgroundColor, children, name, className, ...stuff}) => {	
	return (
		<div data-name={name} className={space('PageCard w-100', className)}>
			<BG image={backgroundImage} color={backgroundColor} />	
			{name? <a name={name} /> : null}
			<div className="container p-2" style={{position: 'relative'}}>
				{children}
			</div>
		</div>
	);
};


export default PageCard;
