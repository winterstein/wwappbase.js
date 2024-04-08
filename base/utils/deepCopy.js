
/**
 * Deep copy any json object. Can be null/undefined. Just can't handle loopy non-tree objects, or native resources (e.g. DOM nodes).
 */
const deepCopy = obj => {
	if ( ! obj) return obj;
	return JSON.parse(JSON.stringify(obj));
};

// NB: VS Code's nice auto-import relies on this (it ignores the export default)
export {deepCopy};
export default deepCopy;
