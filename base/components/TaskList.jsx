import React from 'react';
import { assert, assMatch } from '../utils/assert';
import Login from '../youagain';
import { Modal, ModalHeader, ModalBody, ModalFooter, Form } from 'reactstrap';
import {space, stopEvent} from '../utils/miscutils';

import C from '../CBase';
import List from '../data/List';
import DataStore from '../plumbing/DataStore';

import ListLoad from './ListLoad';
import Task from '../data/Task';
// init basic stuff
import ActionMan from '../plumbing/ActionManBase';
import MDText from './MDText';
import PropControl from './PropControl';
import { publishDraftFn } from './SavePublishDeleteEtc';


const taskEditorDialogPath = ['widget','TaskEditorDialog'];

/**
 * The core "show a task on the side" widget
 *
 * TODO replace check box with green tick
 *
 * ??swallow clicks??
 */
const TaskListItem = ({item}) => {
	// TODO child??
	let path = ['data', 'Task', item.id];
	// glyph fire button?? or a prod button??

	return (
		<div>
			<div className="pull-left">
				<PropControl path={path}
					prop="closed" type="checkbox"
					saveFn={() => publishDraftFn({type:'Task', id:item.id})}
				/>
			</div>
			{item.tags && item.tags.length? <div><small><code>{item.tags.join(" ")}</code></small></div> : null}
			<MDText source={item.text} />
			<div>{item.assigned && item.assigned.length? "@"+item.assigned.join(" @") : null}</div>
			{item.url && item.url !== ''+window.location? <div><small><a href={item.url}>{item.url}</a></small></div> : null}
			<button className="btn btn-xs" onClick={e => {
				DataStore.setValue(taskEditorDialogPath.concat('task'), item);
				DataStore.setValue(taskEditorDialogPath.concat('show'), true);
			}}>edit</button>

			{item.children? item.children.map(kid => <TaskListItem key={kid.id} item={kid} />) : null}

			{item.parent? null : <QuickTaskMaker parent={item} tags={item.tags} />}
		</div>
	);
}; // ./TaskListItem

/**
 * navbar button to show/hide the task list
 */
const TaskListButton = ({bpath, value, list}) => {
	return (
		<Button color="secondary" className="navbar-btn navbar-nav"
			disabled={!bpath}
			onClick={e => DataStore.setValue(bpath, ! value)}
		>
			Tasks {list ? `(${List.total(list)})` : null}
		</Button>
	);
};

/**
 * called by a Page to set the context.
 * Recommended: tags = type e.g. Advert, item.id
 * @param tags {!String[]} Can contain nulls (ignored)
 */
const setTaskTags = (...tags) => {
	if (tags.length===1 && _.isArray(tags[0])) {
		tags = tags[0];
		console.warn("TaskList.jsx - Wrapped array passed in - Please unwrap if using an array for input into setTaskTags(). Use no-args for no-tags.");
	}
	tags = tags.filter(t => t);
	if (tags.length) assMatch(tags, 'String[]', "TaskList.jsx setTaskTags()"); //fails for [] :( TODO fix assMatch
	let oldTags = DataStore.getValue(['widget', 'TaskList', 'tags']);
	if (JSON.stringify(tags) === JSON.stringify(oldTags)) {
		// no-op
		return;
	}
	// we're probably inside a render, so update after the current render
	setTimeout( () => {
		DataStore.setValue(['widget', 'TaskList', 'tags'], tags);
	}, 1);
};

/**
 * The main side-bar list widget + a navbar button.
 * Goes inside the navbar.
 * Gets tags info via #setTaskTags (not parameters)
 *  - cos its inserted in the NavBar, which hasn't the tags info.
 */
const TaskList = ({}) => {
	if ( ! Login.isLoggedIn()) {
		return <TaskListButton disabled />
	}
	// where are we? page + id as tags
	let tags = DataStore.getValue('widget', 'TaskList', 'tags');
	if ( ! tags) {
		console.warn("TaskList.jsx: the active Page should call setTaskTags()");
		tags = [];
	}
	// widget settings
	const wpath = ['widget', 'TaskList', tags.join("+") || 'all'];
	const widget = DataStore.getValue(wpath) || {};

	const type = C.TYPES.Task;
	let q = tags.map(t => "tags:"+t).join(" AND ")
		// assigned.map(t => "assigned:"+t).join(" ")

	const status = C.KStatus.ALL_BAR_TRASH;

	const pvItems = ActionMan.list({type, status, q});

	// button mode?
	if ( ! widget.show) {
		return <TaskListButton bpath={wpath.concat('show')} list={pvItems.value} />
	}

	return (
		<div>
			<TaskListButton bpath={wpath.concat('show')} value={true} list={pvItems.value} />
			<TaskEditorDialog />
			<div className="TaskList avoid-navbar" style={{position:'fixed', right:0, top:0}}>
				<h4>Tasks for {tags.join(" ")}</h4>
				<QuickTaskMaker tags={tags} items={pvItems.value} />
				<div>&nbsp;</div>
				<ListLoad
					canFilter
					q={q}
					type={type}
					status={status}
					ListItem={TaskListItem}
					className="DefaultListLoad"
					canDelete
				/>
			</div>
		</div>
	);
};

/**
 * @param parent {Task}
 * @param items {?List} If provided, optimistic add to this. Useful for filtered lists.
 */
const QuickTaskMaker = ({parent, tags=[], assigned=[], items, textarea, focus, advanced}) => {
	if ( ! Login.isLoggedIn()) {
		return null;
	}
	const qpath = ['widget', 'QuickTaskMaker'];
	if (parent) {
		Task.assIsa(parent, "QuickTaskMaker "+parent);
		qpath.push('reply-to-'+parent.id);
	}
	const quickTask = e => {
		stopEvent(e);
		// make
		let base = DataStore.getValue(qpath);
		base.tags = tags;
		base.assigned = assigned;
		base.parent = parent;
		let task = new Task(base);
		// publish
		if (parent) { // if its a child, save the parent
			ActionMan.publishEdits('Task', parent.id, parent);
		} else {
			ActionMan.publishEdits('Task', task.id, task);
		}
		// clear the form
		DataStore.setValue(qpath, null);
		// optimistic add to list
		// NB: Crud will auto-add to published, but it cant handle auto-add to filtered lists
		if (items && ! parent) {
			List.add(task, items);
		}
	};
	const ttext = DataStore.getValue(qpath.concat('text'));
	// NB: the use of `fast` means we cant put disabled={ ! ttext} on the Add button, as it wouldn't update to non-disabled
	return (
		<div key={'f'} className={space('QuickTaskMaker flex-row', parent? 'QuickTaskMakerReply' : null)}>
			<Form className='flex-grow' onSubmit={quickTask}>
				<PropControl className="w-100"
					type={textarea?"textarea":"text"} path={qpath} prop="text"
					placeholder={parent? 'Reply / Comment' : 'Make a new task'} 
					fast focus={focus}/>
				<div><button className="ml-1 btn btn-primary" type="submit" onClick={quickTask} >Add</button></div>
			</Form>
		</div>		
	);
	// TODO advanced offers
// 	<div className="form-compact form-inline">
// 	<Assignment item={item} path={path} />
// 	<Priority item={item} path={path} />
// 	<Tags item={item} path={path} />
// 	<Deadline item={item} path={path} />
// </div>
/* <Col md="3"><div className="flex-row">
{media.map(m => <a key={m} href={m} target="_blank" className="pull-left"><Misc.ImgThumbnail url={m} /></a>)}
<PropControl collapse path={path.concat('media')} type='imgUpload' prop={media.length} version="mobile" />
</div></Col> */
};

/**
 * a whole page editor
 */
const TaskEditorDialog = () => {
	const widget = DataStore.getValue(taskEditorDialogPath) || {};
	if( ! widget ) return null;

	const {show, task} = widget;

	if ( ! show) return null;
	if ( ! task) return null;

	const taskPath = taskEditorDialogPath.concat('task');
	const {id} = task;

	// const path =

	// Debounce save function
	// Important that this be stored to avoid publish on every key stroke
	let debouncedSaveFn = DataStore.getValue(taskEditorDialogPath.concat('debouncedSaveFn'));
	if( !debouncedSaveFn ) {

		debouncedSaveFn = _.debounce( (id, widget) => {
			ActionMan.publishEdits('Task', id, widget);
		}, 5000);
		DataStore.setValue(taskEditorDialogPath.concat('debouncedSaveFn'), debouncedSaveFn);
	}

	return (
		<Modal isOpen={show} className="TaskEditorModal" onHide={() => DataStore.setValue(taskEditorDialogPath.concat('show'), false)} >
			<ModalHeader closeButton>Edit Task</ModalHeader>
			<ModalBody>
				{/* Would like this to be an actual editable field */}
				<PropControl path={taskPath} prop="url" placeholder="URL" label="URL" type="text" saveFn={() => debouncedSaveFn(id, task)} />
				<PropControl path={taskPath} prop="text" placeholder="Task description" label="Task description" type="text" saveFn={() => debouncedSaveFn(id, task)} />
				<PropControl path={taskPath} prop="tags" placeholder="Tags" label="Task description" type="text" saveFn={() => debouncedSaveFn(id, task)} />
			</ModalBody>
			<ModalFooter />
		</Modal>
	);
}; // ./TaskEditorDialog


export default TaskList;
export {
	setTaskTags,
	QuickTaskMaker
}
