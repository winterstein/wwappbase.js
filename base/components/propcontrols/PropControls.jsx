/**
 * Import the standard propcontrols, so that they get registered.
 * 
 * Usage: import this once in app.jsx
 * 
 */

 // Just importing these gets them registered with PropControl
import PropControlUrl from './PropControlUrl';
import PropControlUpload from './PropControlUpload'
import PropControlPills from './PropControlPills';
import PropControlSelection from './PropControlSelection';
import PropControlDate from './PropControlDate';
import PropControlDataItem from './PropControlDataItem';
import PropControlMoney from './PropControlMoney';
import PropControlDt from './PropControlDt';
// import PropControlEgo from './PropControls/PropControlEgo';
// import PropControlCode from './PropControls/PropControlCode'; this pulls in prism.js as a dependency, so not included in all projects
import PropControlToggle from './PropControlToggle';
import PropControlRange from './PropControlRange';
import PropControlImg from './PropControlImg';


let dummyProtectImportsFromLint = [
	PropControlUrl,
	PropControlUpload,
	PropControlPills,
	PropControlSelection,
	PropControlDataItem,
	PropControlDate,
	PropControlMoney,
	PropControlDt,
	PropControlToggle,
	PropControlRange,
	PropControlImg
];


// no real export - use via PropControl
export default {};
