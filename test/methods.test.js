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

let schema = {
	firstName: String,
	lastName: String,
}
let _id = null;

test('mongoose db initialization', async t => {
	t.plan(2);

	mongooseConnection = await BackwardWrapper.createConnection(MONGODB_URL);
    t.ok(mongooseConnection);
    t.equal(mongooseConnection.readyState, 1, 'Ready state is connected(==1)'); /// connected
});

test('schema initialization', async t => {
	const authorSchema = mongoose.Schema(schema);

	const Author = mongooseConnection.model('Author', authorSchema);

	t.ok(mongooseConnection.models.Author);
});

test('clean up test collections', async t => {
	await mongooseConnection.models.Author.deleteMany({}).exec();
});

test('initialization of API server', async t => {
	///// setting up the server
	fastify = Fastify();
	//
	// // //// need this to handle post/put/patch request parameters
	fastify.register(fastifyFormbody);

	fastify.register(fastifyMongooseAPI, {
			models: mongooseConnection.models,
			setDefaults: true,
		});

	await fastify.ready();

	t.strictSame(fastify.mongooseAPI._methods,
		['list', 'get', 'post', 'patch', 'put', 'delete'],
		'mongooseAPI defaults methods loaded' );

	await fastify.listen(FASTIFY_PORT);
});


test('POST item test', async t => {
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/authors')
		.send({firstName: 'Hutin', lastName: 'Puylo'})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')
	t.match(response.body, {firstName: 'Hutin', lastName: 'Puylo'}, "POST api ok");
	_id = response.body._id;
	t.ok(_id, "_id generated");

	response = await supertest(fastify.server)
		.get('/api/authors')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')


	t.match(response.body.items[0], {firstName: 'Hutin', lastName: 'Puylo'}, "Listed same");
	t.equal(response.body.total, 1, 'There are author now');
});

test('Shutdown API server', async t=>{
	await fastify.close();
});

test('initialization of API server with limited methods', async t => {
	///// setting up the server
	fastify = Fastify();
	//
	// // //// need this to handle post/put/patch request parameters
	fastify.register(fastifyFormbody);

	fastify.register(fastifyMongooseAPI, {
			models: mongooseConnection.models,
			setDefaults: true,
			methods: ['list', 'get'] // read-only
		});

	await fastify.ready();

	t.strictSame(fastify.mongooseAPI._methods,
		['list', 'get'],
		'mongooseAPI custom methods loaded' );

	await fastify.listen(FASTIFY_PORT);
});


test('POST item is invalid', async t => {
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/authors')
		.send({firstName: 'Hutin', lastName: 'Puylo'})
		.expect(404)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body.message, "Route POST:/api/authors not found" , "POST denied");
});

test('GET is valid', async t => {
	let response = null;
	response = await supertest(fastify.server)
		.get('/api/authors/' + _id)
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {firstName: 'Hutin', lastName: 'Puylo'}, "Item found");
});

test('LIST is valid', async t => {
	let response = null;
	response = await supertest(fastify.server)
		.get('/api/authors')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body.items[0], {firstName: 'Hutin', lastName: 'Puylo'}, "Listed same");
	t.equal(response.body.total, 1, 'There are author now');
});

test('teardown', async t=>{
	await fastify.close();
	await mongooseConnection.close();
});