'use strict'

const fastifyMongooseAPI = require('../fastify-mongoose-api.js');

const t = require('tap');
const { test } = t;
const supertest = require('supertest');

const Fastify = require('fastify');
const mongoose = require('mongoose');
const fastifyFormbody = require('fastify-formbody');

const FASTIFY_PORT = 3137;
const MONGODB_URL = 'mongodb://127.0.0.1/fastifymongooseapitest';


let mongooseConnection = null;
let fastify = null;

let isAuthedTestBoolean = false;

test('mongoose db initialization', async t => {
	t.plan(2);

	mongooseConnection = await mongoose.createConnection(MONGODB_URL, { useNewUrlParser: true });
    t.ok(mongooseConnection);
    t.equal(mongooseConnection.readyState, 1, 'Ready state is connected(==1)'); /// connected
});

test('schema initialization', async t => {
	t.plan(2);

	const authorSchema = mongoose.Schema({
		firstName: String,
		lastName: String,
		biography: String,
		created: { 
			type: Date,
			default: Date.now
		}
	});
	authorSchema.index({firstName: 'text', lastName: 'text', biography: 'text'}); /// you can use wildcard here too: https://stackoverflow.com/a/28775709/1119169

	const Author = mongooseConnection.model('Author', authorSchema);

	const bookSchema = mongoose.Schema({
		title: String,
		isbn: String,
		author: { 
	        type: mongoose.Schema.Types.ObjectId, 
	        ref: 'Author'
	    },
		created: { 
			type: Date,
			default: Date.now
		}
	});


	const Book = mongooseConnection.model('Book', bookSchema);

	t.ok(mongooseConnection.models.Author);
	t.ok(mongooseConnection.models.Book);
});

test('clean up test collections', async t => {
	await mongooseConnection.models.Author.deleteMany({}).exec();
	await mongooseConnection.models.Book.deleteMany({}).exec();
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
			checkAuth: async (req, reply)=>{
				if (!isAuthedTestBoolean) {
					const e = new Error('401, honey!');
					e.statusCode = 401;
					throw e;
				}
			},
			methods: ['list', 'get', 'post', 'patch', 'put', 'delete', 'options']
		});

	await fastify.ready();
	await fastify.listen(FASTIFY_PORT);
});

test('Test Auth (not)', async t => {
	let response = null;
	response = await supertest(fastify.server)
		.get('/api/books')
		.expect(401);

	t.same(response.body, {statusCode: 401, error: 'Unauthorized', message: '401, honey!'}, "There is error and no data response");

	response = await supertest(fastify.server)
		.get('/api/authors')
		.expect(401);

	t.same(response.body, {statusCode: 401, error: 'Unauthorized', message: '401, honey!'}, "There is error and no data response");
});


test('Test Auth (authed)', async t => {
	//// sign in 
	isAuthedTestBoolean = true;
	////

	let response = null;
	response = await supertest(fastify.server)
		.get('/api/books')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')
	
	t.match(response.body, {total: 0}, "There is response");

	response = await supertest(fastify.server)
		.get('/api/authors')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {total: 0}, "There is response");
});

test('teardown', async t=>{
	await fastify.close();
	await mongooseConnection.close();


});