
import DataClass, { nonce } from './DataClass';
import C from '../CBase';

class Msg extends DataClass {
	id;
	oxid;
	url;
	created;

	threadId;
	media = [];

	constructor(base) {
		// Pull out parent task so no circular refs
		const { task } = base;
		delete base.task;

		const item = {
			id: nonce(),
			oxid: Login.getId(),
			created: new Date().getTime(),
			threadId: task.id,
			...base // Base comes after defaults so it overrides
		};
		// TODO @you and #tag
		super(item);
		Object.assign(this, item);
	}
};

DataClass.register(Msg, 'Msg');
const This = Msg;
export default Msg;
