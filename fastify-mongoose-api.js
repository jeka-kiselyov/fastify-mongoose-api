const fp = require('fastify-plugin');
const API = require('./src/API.js');
const DefaultModelMethods = require('./src/DefaultModelMethods.js');

function initPlugin(fastify, options, next) {
	options = options || {};
	options.fastify = fastify;

	const api = new API(options);
	fastify.decorate('mongooseAPI', api);

	next();
}

const plugin = fp(initPlugin, {
	fastify: '^2.0.0 || ^3.0.0 || ^4.0.0 || ^5.0.0',
	name: 'fastify-mongoose-api',
});

plugin.DefaultModelMethods = DefaultModelMethods;

module.exports = plugin;
