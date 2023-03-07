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

test('schema ok', async t => {
	let author = new mongooseConnection.models.Author;
	author.firstName = 'Jay';
	author.lastName = 'Kay';
	author.biography = 'Lived. Died.';

	await author.save();

	let book = new mongooseConnection.models.Book;
	book.title = 'The best book';
	book.isbn = 'The best isbn';
	book.author = author;

	await book.save();

	let authorFromDb = await mongooseConnection.models.Author.findOne({firstName: 'Jay'}).exec();
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'The best book'}).exec();

	t.ok(authorFromDb);
	t.ok(bookFromDb);

	await BackwardWrapper.populateDoc(bookFromDb.populate('author'));

	t.equal(''+bookFromDb.author._id, ''+authorFromDb._id);
});


test('initialization of API server', async t => {
	///// setting up the server
	fastify = Fastify();
	//
	// // //// need this to handle post/put/patch request parameters
	fastify.register(fastifyFormbody);

	fastify.register(fastifyMongooseAPI, {
			models: mongooseConnection.models,
			exposeVersionKey: false,
			exposeModelName: true,
			prefix: '/api/',
			setDefaults: true,
			methods: ['list', 'get', 'post', 'patch', 'put', 'delete', 'options']
		});

	await fastify.ready();

	t.ok(fastify.mongooseAPI, 'mongooseAPI decorator is available');
	t.equal(Object.keys(fastify.mongooseAPI.apiRouters).length, 2, 'There are 2 APIRoutes, one for each model');

	t.equal(fastify.mongooseAPI.apiRouters.Author.collectionName, 'authors', 'Collection name used in API path');
	t.equal(fastify.mongooseAPI.apiRouters.Book.collectionName, 'books', 'Collection name used in API path');

	t.equal(fastify.mongooseAPI.apiRouters.Author.path, '/api/authors', 'API path is composed with prefix + collectionName');
	t.equal(fastify.mongooseAPI.apiRouters.Book.path, '/api/books', 'API path is composed with prefix + collectionName');

	await fastify.listen(FASTIFY_PORT);
});


test('GET collection endpoints', async t => {
	let response = null;
	response = await supertest(fastify.server)
		.get('/api/books')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 1, 'API returns 1 book');
	t.equal(response.body.items[0].__modelName, 'Book', 'Model name is present in response');

	t.has(response.body.items[0], {__v: undefined}, 'does not have version field');

	response = await supertest(fastify.server)
		.get('/api/authors')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 1, 'API returns 1 author');
	t.equal(response.body.items.length, 1, 'API returns 1 author');
	t.equal(response.body.items[0].__modelName, 'Author', 'Model name is present in response');

	t.has(response.body.items[0], {__v: undefined}, 'does not have version field');
});

test('ModelName on populated', async t => {
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'The best book'});
	// await bookFromDb.populate('author').execPopulate();
	await BackwardWrapper.populateDoc(bookFromDb.populate('author'));

	let response = null;
	response = await supertest(fastify.server)
		.get('/api/books/'+bookFromDb.id+'?populate=author')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {title: bookFromDb.title, isbn: bookFromDb.isbn}, "Book is ok");
	t.equal(response.body.__modelName, 'Book', 'Model name is present in response');
	t.match(response.body.author, {firstName: bookFromDb.author.firstName, lastName: bookFromDb.author.lastName}, "Populated author is ok");
	t.match(response.body.author, {_id: ''+bookFromDb.author.id}, "Populated author id is ok");
	t.equal(response.body.author.__modelName, 'Author', 'Model name is present in response on populated objects');

	t.has(response.body.author, {__v: undefined}, 'populated does not have version field');
});

test('teardown', async t=>{
	await fastify.close();
	await mongooseConnection.close();
});