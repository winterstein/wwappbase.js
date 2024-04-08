/** Default validator for URL values*/
const urlValidator = ({value, props}) => {
	// no URL is not inherently an error
	if (!value) return;
	// Protocol-relative URLs are fine!
	if (value.startsWith('//')) value = 'https:' + value;

	try {
		const urlObject = new URL(value);

		if (urlObject.protocol !== 'https:') {
			return {
				status: (props.https ? 'error' : 'warning'),
				message: 'Please use https for secure URLs'
			};
		}
	} catch (e) {
		return { status: 'error', message: 'This is not a valid URL' };
	}
};

export {
	urlValidator,
};
