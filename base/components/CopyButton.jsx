import React, { useState } from 'react';
import { Button } from 'reactstrap';
import { copyTextToClipboard, space } from '../utils/miscutils';
import Icon from './Icon';


const CopyButton = ({text, className, children, small, ...props}) => {
	const [hasCopied, setHasCopied] = useState(false);
	const doCopy = () => {
		copyTextToClipboard(text);
		setHasCopied(true);
	};

	return <Button title="Copy"
		className={space('copy-btn', className)}
		size={small ? 'sm' : null}
		color={hasCopied ? 'primary' : 'secondary'}
		onClick={doCopy} {...props}
	>
		{children}{children && ' '}
		<Icon name="copy" />
	</Button>;
};

export default CopyButton;
