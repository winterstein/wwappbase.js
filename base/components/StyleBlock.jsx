/**
 * A css node for custom css
 */
import React, {useState, useRef} from 'react';

/**
 * Wrap the contents in {`   `}, because {}s are special characters for jsx and for css.
 */
const StyleBlock = ({children}) => {	
	return children && children.length? <style>{children}</style> : null;
};

export default StyleBlock;