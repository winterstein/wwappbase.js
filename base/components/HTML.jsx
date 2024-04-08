/**
 * A css node for custom css
 */
import React, {useState, useRef} from 'react';
import HtmlSanitizer from '@jitbit/htmlsanitizer';

const HTML = ({children, unsafe}) => {	
    if ( ! children) return null;
    let __html = unsafe? children : HtmlSanitizer.SanitizeHtml(children);
    return <div dangerouslySetInnerHTML={{__html}} />
};

export default HTML;