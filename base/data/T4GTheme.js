
// no DataClass as this is not AThing
class T4GTheme {
	backdropImages;
	t4gLogo;
	backgroundColor;
}

T4GTheme.valid = (theme) => {
	const valid = !!(
		(
			(theme.backdropImages && theme.backdropImages.length) ||
			(theme.backgroundColor && theme.backgroundColor !== "")
		) &&
		theme.t4gLogo && theme.t4gLogo !== ""
	);
	return valid;
}

export default T4GTheme;