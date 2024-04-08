import React from 'react';
import DataStore from '../plumbing/DataStore';
import Misc from './Misc';
import { assert, assMatch } from '../utils/assert';
import { Button } from 'reactstrap';
import { noVal, space } from '../utils/miscutils';

/**
 * 
 * @param {Object} p
 * @param {Object[]} p.stages {title} ??
 * @param {Number} p.stageNum
 * @param {String[]} p.stagePath whereto store the current stage number
 */
function WizardProgressWidget({stageNum, stages, stagePath}) {
	if ( ! stageNum) stageNum = 0;
	return (<div className="WizardProgressWidget">
		{stages.map((stage, i) => <Stage key={i} title={stage.title} stageNum={stageNum} i={i} stagePath={stagePath} canJumpAhead={stage.canJumpAhead} color={stage.color} />)}
	</div>);
}

function Stage({i, title, stageNum, stagePath, canJumpAhead, color}) {
	// Display in progress as complete if left of the current page
	let complete = i < stageNum;
	// if (stage.complete === false) complete = false; TODO stage.error/warning?
	let c = '';
	if (i == stageNum) {
		c = 'active';
	} else if (complete) {
		c = 'complete';
	}
	const canClick = complete || canJumpAhead;
	const doTheSwitch = () => {
		DataStore.setValue(stagePath, i);
		window.scrollTo(0, 0);
	};
	const maybeSetStage = () => canClick && stagePath && doTheSwitch();

	return (
		<div className={space('Stage', c, color&&"text-"+color)} onClick={maybeSetStage}>
			<h5 className="text-center above">{title}</h5>
			<h5 className="graphic">
				<div className="marker" />
				<div className="line" />
			</h5>
			<h5 className="text-center below">{title}</h5>
		</div>
	);
}

class StageNavStatus {
	/** @type {Boolean} */
	next;
	/** @type {Boolean} */
	previous;
	/** @type {Boolean} */
	sufficient;
	/** @type {Boolean} */
	complete;
};

/**
 * @param {Object} p
 * @param {!String} p.title
 * next, previous, sufficient, 
 * @param {?Boolean} p.complete Pass in true when the stage is complete
 * @param {?Boolean} p.canJumpAhead If set, allow clicking ahead. NB: This prop is copied into the progress bar widget
 * 
 * NB: these are used by the surrounding widgets - progress & next/prev buttons
 *
 * Also for convenient lazy setting of sufficient/complete, a function is passed to children:
 * setNavStatus({sufficient, complete})
 *
 * @param {?Boolean} p.sufficient default=true
 * @param {?Boolean} p.complete default=false
 *
 * To get this, the child must have a boolean setNavStatus flag, which gets replaced.
 * @param {?Function} p.onNext function called when user interacts with "next" button
 * @param {?Function} p.onPrev function called when user interacts with "prev" button
 * 
 * @param {?String} p.navPosition "top"|"bottom"|"both" Defaults to bottom. Usually set by parent Wizard tag
 */
function WizardStage({stageKey, stageNum, stagePath, maxStage, next, previous,
	sufficient=true, complete=false,
	title, onNext, onPrev, children, canJumpAhead, navPosition="bottom"}) {
	assert(!noVal(stageNum));
	assMatch(maxStage, Number);
	if (stageKey != stageNum) { // allow "1" == 1
		return null; //<p>k:{stageKey} n:{stageNum}</p>;
	}

	// allow sections to set sufficient, complete, next, previous
	const navStatus = {next, previous, sufficient, complete};
	/** @param {StageNavStatus} newStatus */
	const setNavStatus = (newStatus) => {
		Object.assign(navStatus, newStatus);
	};
	// pass in setNavStatus
	if (children) {
		// array of elements (or just one)?
		if (children.filter) children = children.filter(x => !! x);
		children = React.Children.map(children, (Kid, i) => {
			// clone with setNavStatus?
			// But not on DOM elements cos it upsets React.
			// So only if they gave the setNavStatus flag.
			let sns = Kid.props && Kid.props.setNavStatus;
			if ( ! sns) return Kid;
			assert(sns===true, "WizardProgressWidget: setNavStatus must be boolean (it is replaced with a function): "+sns);
			return React.cloneElement(Kid, {setNavStatus});
		});
	}

	return (<div className="WizardStage">		
		{(navPosition === "top" || navPosition === "both") && <WizardNavButtons stagePath={stagePath} title={title} navStatus={navStatus} maxStage={maxStage}
			onNext={onNext} onPrev={onPrev}
			navPosition={navPosition}
		/>}
		{children}
		{(navPosition === "bottom" || navPosition === "both") && <WizardNavButtons stagePath={stagePath} title={title} navStatus={navStatus} maxStage={maxStage}
			onNext={onNext} onPrev={onPrev}
			navPosition={navPosition}
		/>}		
	</div>);
}


/**
 *
 * @param {
 * 	maxStage: {Number}
 * }
 */
function NextButton({complete, stagePath, maxStage, onNext, ...rest}) {
	const colour = complete ? 'primary' : undefined;
	assMatch(maxStage, Number);
	return (
		<NextPrevTab stagePath={stagePath} colour={colour} diff={1} maxStage={maxStage} {...rest} callback={onNext}>
			Next <b>&gt;</b>
		</NextPrevTab>
	);
}

function PrevButton({stagePath, onPrev, ...rest}) {
	return <NextPrevTab stagePath={stagePath} diff={-1} callback={onPrev} {...rest}>
		<b>&lt;</b> Previous
	</NextPrevTab>
}

function NextPrevTab({stagePath, diff, children, colour = 'secondary', maxStage, callback, ...rest}) {

	assMatch(stagePath, 'String[]');
	assMatch(diff, Number);
	assert(children, 'WizardProgressWidget.js - no button content');
	const stage = parseInt(DataStore.getValue(stagePath) || 0);

	if (stage === 0 && diff < 0) {
		return <div></div>; // no previous on start - dummy for flex layout
	}
	if (maxStage && stage >= maxStage && diff > 0) {
		return <div></div>; // no next on end - dummy for flex layout
	}

	const onClick = () => {
		let n = stage + diff;
		DataStore.setValue(stagePath, n);
		window.scrollTo(0,0);
		if (callback) callback();
	};

	// use Bootstrap pull class to left/right float
	const pull = (diff > 0) ? 'pull-right' : 'pull-left';

	return (
		<Button size="lg" color={colour} className={pull} onClick={onClick} {...rest}>
			{children}
		</Button>
	);
}

/**
 * @param {Object} p
 * @param {?String} p.navPosition "top"|"bottom"|"both" Defaults to bottom
 * @returns 
 */
function Wizard({widgetName, stagePath, navPosition, children}) {
	// NB: React-BS provides Accordion, but it does not work with modular panel code. So sod that.
	if ( ! stagePath) stagePath = ['widget', widgetName || 'Wizard', 'stage'];
	let stageNum = DataStore.getValue(stagePath);
	if ( ! stageNum) stageNum = 0; // default to first kid open
	if ( ! children) {
		return (<div className="Wizard"></div>);
	}
	// filter null, undefined
	children = children.filter(x => !! x);
	// get stage info for the progress bar {title, color, ...props}
	let stages = children.map( (kid, i) => {
		let props = Object.assign({}, kid.props);
		if ( ! props.title) props.title = 'Step '+i;
		return props;
	});
	// so next can recognise the end
	const maxStage = stages.length - 1;
	// add overview stage info to the stages
	let kids = React.Children.map(children, (Kid, i) => {
		// active?
		if (i != stageNum) {
			return null;
		}
		// clone with stageNum/path/key
		return React.cloneElement(Kid, {stageNum, stagePath, stageKey:i, maxStage, navPosition});
	});
	// filter null again (we should now only have the active stage)
	kids = kids.filter(x => !! x);
	let activeStage = kids[0];

	return (<div className="Wizard">
		<WizardProgressWidget stages={stages} stagePath={stagePath} stageNum={stageNum} />
		{kids}
	</div>);
}

function WizardNavButtons({stagePath, maxStage, navStatus, onNext, onPrev, navPosition, title}) {
	assert(stagePath, "WizardProgressWidget.jsx - WizardNavButtons: no stagePath");
	let {next, previous, sufficient, complete} = navStatus;
	// read from WizardStage props if set, or setNavStatus
	// navStatus;
	if (complete) sufficient = true;
	let msg = ! sufficient? 'Please fill in more of the form' : null;
	return (<div className={space("nav-buttons-"+navPosition, "nav-buttons flex-row w-100 justify-content-between")}>
		{previous===false? <div></div> : // dummy element for flex layout
			<PrevButton stagePath={stagePath} onPrev={onPrev} />
		}
		{navPosition==="top" && title && <h2>{title}</h2>}
		{next===false? <div></div> : // dummy for flex layout
			<NextButton stagePath={stagePath} maxStage={maxStage} disabled={ ! sufficient} complete={complete} title={msg} onNext={onNext} />
		}
	</div>);
}

export {Wizard, WizardStage, WizardProgressWidget};
export default Wizard;
