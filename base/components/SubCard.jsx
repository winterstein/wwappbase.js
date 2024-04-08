import React from 'react';
import {Card, CardTitle} from 'reactstrap';
import { space } from '../utils/miscutils';

/**
 * Convenience for a card/panel within a card (with a sensible default style).
 * @param {Object} p 
 * @param {string} [p.title]
 * @param {string} [p.className] className passthrough
 * @param {JSX.Element[]} [p.children]
 * @param {string} [p.color]
 */
function SubCard({title,className,children,color="light"}) {
	return <Card body color={color} className={space(className, 'mb-3')} >{title && <h5 className="card-title">{title}</h5>}{children}</Card>;
}

export default SubCard;