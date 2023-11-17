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
		appleCount: Number,
		bananaCount: Number,
	});

	schema.statics.onListQuery = async function(query, request) {
		let evenBananas = request.query.even ? request.query.even : null;
		if (evenBananas) {
			query = query.and({ bananaCount: { $mod: [ 2, 0 ] } });
		}

		// DO NOT RETURN THE QUERY
	}

	mongooseConnection.model('WhereTest', schema);
	t.ok(mongooseConnection.models.WhereTest);
});


test('clean up test collections', async () => {
	await mongooseConnection.models.WhereTest.deleteMany({}).exec();
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
	t.equal(fastify.mongooseAPI.apiRouters.WhereTest.collectionName, 'wheretests', 'Collection name used in API path');

	await fastify.listen(FASTIFY_PORT);
});

test('POST item test', async t => {
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/wheretests')
		.send({name: 'Bob', appleCount: 1, bananaCount: 2})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {name: 'Bob', appleCount: 1, bananaCount: 2}, "POST api ok");


	response = await supertest(fastify.server)
		.post('/api/wheretests')
		.send({name: 'Rob', appleCount: 2, bananaCount: 3})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {name: 'Rob', appleCount: 2, bananaCount: 3}, "POST api ok");

	response = await supertest(fastify.server)
		.post('/api/wheretests')
		.send({name: 'Alice', appleCount: 50, bananaCount: 90})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {name: 'Alice', appleCount: 50, bananaCount: 90}, "POST api ok");

	response = await supertest(fastify.server)
		.get('/api/wheretests')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 3, 'There re 3 banana holders');
});


test('GET collection onListQuery', async t => {
	let response = null;

	response = await supertest(fastify.server)
		.get('/api/wheretests')
		// .query({ where: "{\"bananaCount\": 2}" }) //// URL GET parameters
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 3, 'API returns total 3 items');
	t.equal(response.body.items.length, 3, 'API returns total 3 items');

	response = await supertest(fastify.server)
		.get('/api/wheretests')
		.query({ even: true }) //// URL GET parameters
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 2, 'API returns 2 filtered');
	t.equal(response.body.items.length, 2, 'API returns 2 filtered');  /// banana == 2 and banana == 90
});

test('teardown', async ()=>{
	await fastify.close();
	await mongooseConnection.close();
});