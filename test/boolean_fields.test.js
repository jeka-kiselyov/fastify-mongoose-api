'use strict'

const fastifyMongooseAPI = require('../fastify-mongoose-api.js');

const t = require('tap');
const { test } = t;
const supertest = require('supertest');

const Fastify = require('fastify');
const mongoose = require('mongoose');
const fastifyFormbody = require('@fastify/formbody');

const FASTIFY_PORT = 3137;
// eslint-disable-next-line no-undef
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
		aGoodMan: Boolean,
	});

	mongooseConnection.model('BooleanTest', schema);
	t.ok(mongooseConnection.models.BooleanTest);
});

test('clean up test collections', async () => {
	await mongooseConnection.models.BooleanTest.deleteMany({}).exec();
});

test('initialization of API server', async t => {
	///// setting up the server
	fastify = Fastify();
	//
	// // //// need this to handle post/put/patch request parameters
	fastify.register(fastifyFormbody);

	fastify.register(fastifyMongooseAPI, {
			models: mongooseConnection.models
		});

	await fastify.ready();

	t.ok(fastify.mongooseAPI, 'mongooseAPI decorator is available');
	t.equal(fastify.mongooseAPI.apiRouters.BooleanTest.collectionName, 'booleantests', 'Collection name used in API path');

	await fastify.listen(FASTIFY_PORT);
});

test('POST item test', async t => {
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/booleantests')
		.send({name: 'Good', aGoodMan: true})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {name: 'Good', aGoodMan: true}, "POST api ok");

	response = await supertest(fastify.server)
		.get('/api/booleantests')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 1, 'There is one good man');
});


test('POST item false test', async t => {
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/booleantests')
		.send({name: 'Bad', aGoodMan: false})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {name: 'Bad', aGoodMan: false}, "POST api ok");

	response = await supertest(fastify.server)
		.get('/api/booleantests')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 2, 'There re 2 men');
});



test('Update to false test', async t => {
	let response = null;

	response = await supertest(fastify.server)
		.get('/api/booleantests')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 2, 'There re 2 men');

	let goodId = null;
	let foundGood = false;
	for (let item of response.body.items) {
		if (item.aGoodMan === true) {
			goodId = item._id;
			foundGood = true;
		}
	}

	t.ok(foundGood);

	response = await supertest(fastify.server)
		.put('/api/booleantests/'+goodId)
		.send({aGoodMan: false})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8');


	t.match(response.body, {name: 'Good', aGoodMan: false}, "PUT api ok");
});

test('GET collection filtering', async t => {
	let response = null;

	response = await supertest(fastify.server)
		.get('/api/booleantests')
		.query({ filter: 'aGoodMan=0' }) //// URL GET parameters
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 2, 'API returns 2 filtered men');
	t.equal(response.body.items.length, 2, 'API returns 2 filtered men');
});


test('And back to true', async t => {
	let response = null;

	response = await supertest(fastify.server)
		.get('/api/booleantests')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 2, 'There re 2 men');

	let goodId = null;
	let foundGood = false;
	for (let item of response.body.items) {
		if (item.name === 'Good') {
			goodId = item._id;
			foundGood = true;
		}
	}

	t.ok(foundGood);

	response = await supertest(fastify.server)
		.put('/api/booleantests/'+goodId)
		.send({aGoodMan: true})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8');


	t.match(response.body, {name: 'Good', aGoodMan: true}, "PUT api ok");
});

test('GET collection filtering', async t => {
	let response = null;

	response = await supertest(fastify.server)
		.get('/api/booleantests')
		.query({ filter: 'aGoodMan=0' }) //// URL GET parameters
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 1, 'API returns 1 filtered man');
	t.equal(response.body.items.length, 1, 'API returns 1 filtered man');
	t.match(response.body.items[0], {name: 'Bad', aGoodMan: false}, "Filtered author");
});

test('GET collection filtering', async t => {
	let response = null;

	response = await supertest(fastify.server)
		.get('/api/booleantests')
		.query({ filter: 'aGoodMan=1' }) //// URL GET parameters
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 1, 'API returns 1 filtered man');
	t.equal(response.body.items.length, 1, 'API returns 1 filtered man');
	t.match(response.body.items[0], {name: 'Good', aGoodMan: true}, "Filtered author");
});

test('teardown', async ()=>{
	await fastify.close();
	await mongooseConnection.close();
});