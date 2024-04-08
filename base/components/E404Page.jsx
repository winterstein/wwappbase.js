import React from 'react';
import E401Page from './E401Page'; // deprecated - June 2023

const E404Page = () => {
	return (
		<div className="E404Page">
			<h1>Error 404: Page not found</h1>

			<p>
				Sorry: <code>{""+window.location}</code> is not a valid page url.
			</p>

		</div>
	);
};

export {E401Page}; // deprecated

export default E404Page;
