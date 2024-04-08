import { useEffect, useState } from 'react';
import _ from 'lodash';
import $ from 'jquery';


const LONG_POLL_DEBOUNCE_MSECS = 100;
const LONG_POLL_LEEWAY_MSECS = 1000;


// TODO Replace jQuery ajax with fetch
const poll = _.debounce(({url, timeout, looper, setRes, setLooper, callback}) => {
	$.ajax({
		url,
		type: "GET",
		timeout,
		success: (data, status) => {
			setRes(data);
			setLooper(looper + 1); // make sure to trigger a new request in case data hasnt changed
			callback(data);
		},
		error: (xhr, status, errorThrown) => {
			if (status === "timeout") {
				setLooper(looper + 1); // renew the poll
			} else {
				console.error("Error while long polling at", url, status, errorThrown);
			}
		}
	});
}, LONG_POLL_DEBOUNCE_MSECS);


/**
 * React hook for contacting a long polling endpoint
 * @param {Function} callback 
 * @param {String} url 
 * @param {Number} timeout 
 */
export const useLongPoll = (callback, url, timeout) => {
	const [res, setRes] = useState(null);
	const [looper, setLooper] = useState(0);

	useEffect(() => {
		if (!url) {
			setRes(null);
			setLooper(0);
			return;
		}
		const parsedUrl = new URL(url);
		if (timeout) parsedUrl.searchParams.set('timeout', timeout + LONG_POLL_DEBOUNCE_MSECS + LONG_POLL_LEEWAY_MSECS);
		url = parsedUrl.toString();
		poll({url, timeout, looper, setRes, setLooper, callback});
	}, [url, timeout, res, looper]);

	return res;
};
