
// Link just uses Claim

import Claim from './Claim';
import XId from './XId';

const Link = Claim; //new DataClass('Link', Claim);

/**
 * @param {Link} link 
 * @returns {XId}
 */
Link.to = (link) => link.v;

export default Link;
