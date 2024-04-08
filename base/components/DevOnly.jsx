import React from 'react';
import Roles from '../Roles';
import { space } from '../utils/miscutils';


/**
 * Only show the contents to GL developers (or testers, if "test" flag set).
 * See also TODO. Use TODO for work-in-progress, and DevOnly for long-term dev-only content.
 * @param {Object} p
 * @param {boolean} [p.bare] Set to omit wrapper element and just return children.
 * @param {boolean} [p.test] Set to allow tester users (less access than dev) to see contents.
 * @param {String|Function} [p.Tag] Default is <div> but can be any tagname or JSX component which accepts children
 * @param {String} [p.className] Concatenated with default class ".dev-only" on wrapper element
 */
function DevOnly({bare, test, Tag = 'div', className, children, ...props}) {
	// Allow more readable syntax like <DevOnly>{conditional && <ChildElement />}</DevOnly> without creating an empty div
	if (!children) return null;
	if (!Roles.isDev() && !(test && Roles.isTester())) return null;
	if (bare) return children;

	return <Tag className={space('dev-only', className)} {...props}>
		{children}
		<div className="dev-only-marker">Admin</div>
	</Tag>;
}

export default DevOnly;
