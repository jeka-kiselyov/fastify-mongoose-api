'use strict'

const fastifyMongooseAPI = require('../fastify-mongoose-api.js');

const t = require('tap');
const { test } = t;
const supertest = require('supertest');

const Fastify = require('fastify');
const mongoose = require('mongoose');
const fastifyFormbody = require('fastify-formbody');

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
	// t.plan(2);

	// const biographyEpochSchema = mongoose.Schema({ title: String, year: Number });

	const authorSchema = mongoose.Schema({
		firstName: String,
		lastName: String,
		biography: { description: String, born: Number },
		created: {
			type: Date,
			default: Date.now
		}
	});

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
			prefix: '/api/',
			setDefaults: true,
			methods: ['list', 'get', 'post', 'patch', 'put', 'delete', 'options']
		});

	await fastify.ready();

	t.ok(fastify.mongooseAPI, 'mongooseAPI decorator is available');

	t.equal(fastify.mongooseAPI.apiRouters.Author.collectionName, 'authors', 'Collection name used in API path');
	t.equal(fastify.mongooseAPI.apiRouters.Author.path, '/api/authors', 'API path is composed with prefix + collectionName');

	await fastify.listen(FASTIFY_PORT);
});


test('POST item test', async t => {
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/authors')
		.send({firstName: 'Hutin', lastName: 'Puylo', "biography.description": 'was good', "biography.born": '1960'})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {firstName: 'Hutin', lastName: 'Puylo', biography: {description: 'was good', born: 1960}}, "POST api ok");

	response = await supertest(fastify.server)
		.get('/api/authors')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')


	t.match(response.body.items[0], {firstName: 'Hutin', lastName: 'Puylo', biography: {description: 'was good', born: 1960}}, "Listed same");
	t.equal(response.body.total, 1, 'There are author now');
});

test('PUT item test', async t => {
	let authorFromDb = await mongooseConnection.models.Author.findOne({firstName: 'Hutin'});
	// await BackwardWrapper.populateDoc(bookFromDb.populate('author'));

	let response = null;
	response = await supertest(fastify.server)
		.put('/api/authors/'+authorFromDb.id)
		.send({lastName: 'Chuvachello', "biography.born": 1961})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {firstName: 'Hutin', lastName: 'Chuvachello', biography: {description: 'was good', born: 1961}}, "PUT api ok");
});

test('teardown', async t=>{
	await fastify.close();
	await mongooseConnection.close();
});