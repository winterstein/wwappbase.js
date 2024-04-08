
/** Data model functions for the Advert data-type. */
import { assert, assMatch } from '../utils/assert';
import DataClass from './DataClass';


class ChatLine extends DataClass {
	/** @type {String} XId or "user" */
	from;
	/** @type {String} */
	text;

	created;

	/**
	 * @param {ChatLine|Message} base 
	 */
	 constructor(base) {
		super();
		DataClass._init(this, base);
		if (base.content) {	// smartsupp message format
			this.text = base.content.text;
		}
	}
}

/**
 * NB: in shared base, cos Portal and CalStat use this
 */
class Chat extends DataClass {	

	/**
	 * @type {ChatLine[]} 
	*/
	lines = [];

	/**
	 * @param {String}
	 */
	lastText;

	/**
	 * @param {Chat|Message} base 
	 */
	constructor(base) {
		super();
		DataClass._init(this, base);
		if (base.chatId) {	// smartsupp message format
			this.id = base.chatId;
		}
	}
}
DataClass.register(Chat, "Chat"); 

Chat.addLine = (chat, chatLine) => {
	Chat.assIsa(chat);
	ChatLine.assIsa(chatLine);
	chat.lines.push(chatLine);
	chat.lastText = chatLine.text;
	return chat;
};

Chat.lastLine = chat => {
	Chat.assIsa(chat);
	return chat.lines[chat.lines.length-1];
};

export default Chat;
export {
	ChatLine
};
