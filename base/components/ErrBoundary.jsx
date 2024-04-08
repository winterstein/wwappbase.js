
import React from 'react';

/**
 *
 * copy pasta from https://reactjs.org/docs/error-boundaries.html
 */
class ErrBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error) {
		// Update state so the next render will show the fallback UI.
		return { hasError: true, error };
	}

	componentDidCatch(error, errorInfo) {
		// You can also log the error to an error reporting service
		console.error("ErrBoundary", error, errorInfo);
		if (this.props.onError) {
			try {
				this.props.onError(error, errorInfo);
			} catch(doh) {
				console.error("onError fail", doh);
			}
		}
	}

	render() {
		if (this.state.hasError) {
			// You can render any custom fallback UI
			return <div className="alert alert-danger"><h1>Something went wrong.</h1>{""+this.state.error}</div>;
		}

		return this.props.children;
	}
}
export default ErrBoundary;
