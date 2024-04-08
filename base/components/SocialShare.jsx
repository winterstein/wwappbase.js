
// TODO move social share buttons from DonationForm here

import React from 'react';
import {encURI} from '../utils/miscutils';

import DataStore from '../plumbing/DataStore';
import C from '../CBase';

import Misc from './Misc.jsx';
import NGO from '../data/NGO';

/**
 * Share on Facebook etc
 *
 * There are default display icons for each service, but you can provide children to use instead
 * @param service. Options: 'twitter', 'facebook', 'linkedin'
 * @param {!String} url for the thing being shared
 * @param Data to be encoded in to href. Of form {message: ''}. Each social media uses different keys
 * TODO: Replace pngs with svgs (preferably inline)
 * @param children {?JSX} optionally specify the contents. If unset, default images are used.
 */
function IntentLink({children, service, style={}, text, url}) {
	service = service.toLowerCase();

	url = encodeURIComponent(url);

	let href;
	let img;
	if ( service === 'twitter' ) {
		href = `https://twitter.com/intent/tweet?text=${text}&amp;tw_p=tweetbutton&amp;url=${url}`;
		img = '/img/twitter.png';
	} else if ( service === 'facebook' ) {
		href = `http://www.facebook.com/sharer.php?u=${url}&amp;quote=${text}`;
		img = '/img/facebook.png';
	} else if ( service === 'linkedin' ) {
		href = `https://www.linkedin.com/shareArticle?mini=true&amp;title=Our%20ads%20are%20raising%20money%20for%20charity&amp;url=${url}&amp;summary=${text}`;
		img = '/img/linkedin-white.png';
	} else {
		console.error('Invalid service param provided to IntentLink component. Valid values are twitter, facebook or linkedin');
		return;
	}
	let icon = (<div className={'intent-link bg-'+service} style={{...style}}>
		<img alt={service} src={img} crop="50%" title={'share on '+service} />
	</div>);

	return (
		<a href={href} target="_blank" rel="noreferrer" style={{display: 'inline-block', ...style}} >
			{ children || icon }
		</a>
	);
}

export {
	IntentLink
};
