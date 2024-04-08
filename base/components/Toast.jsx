import React, { useState, useEffect } from 'react';
import { space } from '../utils/miscutils';
/**
TODO How does this overlap with Messaging.js and MessageBar.jsx?? 
Do we want to refactor these into one thing??
*/
const Toast = ({children, duration}) => {

    const [showing, setShowing] = useState(true);
    const [finishedAnim, setFinishedAnim] = useState(false);

    useEffect(() => {
        setTimeout(() => {
            setShowing(false);
            // outro takes 0.5s
            setTimeout(() => setFinishedAnim(true), 500);
        }, duration);
    }, []);

    return !finishedAnim && <div className={space('gl-toast d-flex flex-row justify-content-center align-items-center', showing ? "show" : "hide")}>
        <img src="/img/gl-logo/LogoMark/logo.blue.svg" className='logo'/> {children}
    </div>;

};

export default Toast;
