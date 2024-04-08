
/**
 * TODO fix trailing ,
 * 
 * {
	"KEY PEOPLE": [
		{
			"name": "Xi Jinping",
 json2 {
	"KEY PEOPLE": [
		{
			"name": "Xi Jinping",
}]}


TODO fix key
cleanJson2 SyntaxError: Unexpected token '}', ..."			"TOPIC"}]}" is not valid JSON
    at JSON.parse (<anonymous>)
    at cleanJson2 (clean-json.js:94:8)
    at cleanJson (clean-json.js:23:10)
    at AnswerViaWebSocket.<anonymous> (HomePage.jsx:74:24) json {
	"KEY PEOPLE": [
		{
			"name": "Xi Jinping",
			"TOPIC json2 {
	"KEY PEOPLE": [
		{
			"name": "Xi Jinping",
			"TOPIC"}]}

 */

function cleanJson(json) {
	// is it valid already?
	try {
		if (JSON.parse(json)) return json;
	} catch (e) {
		// console.warn("cleanJson", e, "json",json);		
		// crop to start / finish? Because sometimes ChatGPT does wrapping text
		let i = json.indexOf("{");
		let li = json.lastIndexOf("}");
		let j = json.indexOf("[");
		let lj = json.lastIndexOf("]");
		let json2 = json;
		if (i >= 0 && (j < 0 || i < j)) {
			if (li===-1) li = json.length;
			json2 = json.substring(i, li);			
		} else if (j >= 0) {
			if (lj===-1) lj = json.length;
			json2 = json.substring(j, lj);			
		} else {
			console.warn("No json {} or []", json);
		}
		return cleanJson2(json2);
	}
}

/**
 * close open stack parts
 * @param {*} json Valid except perhaps incomplete
 * @returns 
 */
function cleanJson2(json) {
	let stack = [];
	let current;
	for(let i=0; i<json.length; i++) {
		const c = json[i];
		if (c === " " || c === "\t" || c==="\r" || c==="\n") continue; // ignore whitespace
		if (current == ":") { //anything closes a key:value pair
			stack.pop();
			current = null;
		}
		// string?
		if (current === '"') {
			if (c === "\\") {
				i++; // skip next
				// NB: can just be fooled by a string ending in \\
				continue;
			}
			if (c==='"') {
				stack.pop();
				current = null;
			}
			continue;
		}
		if (current === "{") {
			stack.push("=");
		}
		if (c==='"') {
			stack.push(c);
			current = c;
			continue;
		}
		if (c === ":") {
			if (stack[stack.length-1] === "=") {
				stack.pop();
			}
			stack.push(c);
			current = c;
			continue;
		}
		if (c === "{" || c === "[") {
			stack.push(c);
			current = c;
			continue;
		}
		if (c === "}" || c === "]") {
			stack.pop();
			continue;
		}
		// check for number, bool -- or just ignore possible error??
		// console.warn("cleanJson2", "unexpected", c, "json", json.substring(0, i));		
	}
	let json2 = json;	
	// console.log("cleanJson2", json, stack);
	for(let i=stack.length-1; i>-1; i--) {
		let si = stack[i];
		if (si === "{") json2 += "}";
		else if (si === "[") json2 += "]";
		else if (si === ":") json2 += "null";
		else if (si === '"') json2 += '"';
		else if (si === '=') json2 += ':null';
	}
	try {
		JSON.parse(json2);	
	} catch (e) {
		console.warn("cleanJson2", e, "json",json, "json2", json2);
	}
	return json2;
}

window.cleanJson2 = cleanJson2; // DEBUG

export default cleanJson;
