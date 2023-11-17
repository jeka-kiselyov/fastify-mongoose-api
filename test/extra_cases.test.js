'use strict'

const fastifyMongooseAPI = require('../fastify-mongoose-api.js');

const t = require('tap');
const { test } = t;
const supertest = require('supertest');

const Fastify = require('fastify');
const mongoose = require('mongoose');
const fastifyFormbody = require('@fastify/formbody');

const FASTIFY_PORT = 3137;
const MONGODB_URL = process.env.DATABASE_URI || 'mongodb://127.0.0.1/fastifymongooseapitest';

const BackwardWrapper = require('./BackwardWrapper.js');

let mongooseConnection = null;
let fastify = null;


test('mongoose db initialization', async t => {
	t.plan(2);

	mongooseConnection = await BackwardWrapper.createConnection(MONGODB_URL);
    t.ok(mongooseConnection);
    t.equal(mongooseConnection.readyState, 1, 'Ready state is connected(==1)'); /// connected
});

test('schema initialization', async t => {
	const schema = mongoose.Schema({
		name: String,
	});
	schema.methods.apiValues = function () {  return {name: this.name};  };
	schema.methods.apiPut = function () {  return {name: this.name};  };
	schema.methods.apiDelete = function () {  return {name: this.name};  };

	schema.statics.apiPost = function () {  return {name: this.name};  };
	schema.statics.apiSubRoutes = function () {  return [];  };

	const Test = mongooseConnection.model('Test', schema);
	t.ok(mongooseConnection.models.Test);
});

test('does not let initialize plugin class directly', async t => {
	t.throws(() => {
		const obj = new fastifyMongooseAPI();
	});
	t.throws(() => {
		const obj = new fastifyMongooseAPI({fastify: 1});
	});
	t.throws(() => {
		const obj = new fastifyMongooseAPI({models: 3});
	});
});

test('initialization of API server', async t => {
	///// setting up the server
	fastify = Fastify();
	//
	// // //// need this to handle post/put/patch request parameters
	fastify.register(fastifyFormbody);

	fastify.register(fastifyMongooseAPI, {
			models: mongooseConnection.models,
			setDefaults: false
		});

	await fastify.ready();

	t.ok(fastify.mongooseAPI, 'mongooseAPI decorator is available');
	// t.equal(Object.keys(fastify.mongooseAPI.apiRouters).length, 2, 'There are 2 APIRoutes, one for each model');

	// t.equal(fastify.mongooseAPI.apiRouters.Author.collectionName, 'authors', 'Collection name used in API path');
	// t.equal(fastify.mongooseAPI.apiRouters.Book.collectionName, 'books', 'Collection name used in API path');

	// t.equal(fastify.mongooseAPI.apiRouters.Author.path, '/api/authors', 'API path is composed with prefix + collectionName');
	// t.equal(fastify.mongooseAPI.apiRouters.Book.path, '/api/books', 'API path is composed with prefix + collectionName');

	await fastify.listen(FASTIFY_PORT);
});


test('teardown', async t=>{
	await fastify.close();
	await mongooseConnection.close();
});