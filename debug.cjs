const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
	console.log('LOADING:', request, 'from', parent?.filename);
	return origLoad.apply(this, arguments);
};
