/**
 * Note: Tasks do NOT have a draft stage
*/
import { assert, assMatch } from '../utils/assert';
import Enum from 'easy-enums';

import DataClass, {getType, nonce} from './DataClass';
import C from '../CBase';
import DataStore from '../plumbing/DataStore';


const TASKS_SERVER = "calstat.good-loop.com";

/** impact utils */
class Task extends DataClass {

	id;
	oxid;
	url;
	created;

	assigned = [];
	tags = [];
	media = [];
	messages = [];

	/**
	 * @type {Task[]}
	 */
	children;

	constructor(base) {
		const item = {
			id: nonce(),
			oxid: Login.getId(),
			url: ""+window.location, // The whole url! Which could pick up misc cookies accidentally (cookie crumbs)
			created: new Date().getTime(),
			...base // Base comes after defaults so it overrides
		};
		// HACK no url on the tasks server itself
		if (item.url.includes(TASKS_SERVER)) delete item.url;
		// TODO @you and #tag
		super(item);
		Object.assign(this, item);
		// parent-child
		if (item.parent) {
			Task.setParent(this, item.parent);
		}
	}
};
DataClass.register(Task, 'Task');
const This = Task;
export default Task;

const STAGE_CLOSED = 'closed';

/**
 * Set links in both objects.
 */
Task.setParent = (child, parent) => {
	Task.assIsa(child, "Task.js child not a Task");
	Task.assIsa(parent, "Task.js parent not a Task");
	let kids = parent.children || [];
	// guard against dupes
	if ( ! kids.find(k => k.id===child.id)) {
		parent.children = kids.concat(child);
	}
	// avoid circular ref, which breaks json
	delete child.parent;
	child.parentId = parent.id;
};

/**
 * 
 * @param {!Task} task 
 * @returns {!Date} if unset, returns a far-future date
 */
Task.dueDate = task => new Date(task.due || "3000-01-01");

Task.STAGES = new Enum('assigned wip testing done closed')

/**
 * It's done! close the task
 */
Task.close = task => {
	task.closed = true;
	task.stage = Task.STAGES.closed;
	pokeDS(task);
	return task;
};

/**
 * 
 * Poke DataStore, so that the dirty flag is updated
 */
const pokeDS = task => {
	DataStore.setLocalEditsStatus("Task", task.id, C.STATUS.dirty, false);
};

Task.open = task => {
	task.closed = false;
	task.stage = Task.STAGES.assigned;
	pokeDS(task);
	return task;
};
