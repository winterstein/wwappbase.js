import React from 'react';
import { LoginWidgetEmbed } from './LoginWidget';

const E401Page = () => {
	return (
		<div className="E404Page">
			<h1>Error 401: You're not logged in</h1>

			<p>
				Sorry: <code>{""+window.location}</code> needs a valid login.
			</p>
            <LoginWidgetEmbed verb="login" canRegister={false} />
		</div>
	);
};

export default E401Page;
