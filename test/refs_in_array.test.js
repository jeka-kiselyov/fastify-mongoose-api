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
	t.plan(2);

	const authorSchema = mongoose.Schema({
		firstName: String,
		lastName: String,
		biography: String,
		created: {
			type: Date,
			default: Date.now
		},
		inspired: [{ type : mongoose.Schema.Types.ObjectId, ref: 'Book' }], // store books author was inpired by
	});
	authorSchema.index({firstName: 'text', lastName: 'text', biography: 'text'}); /// you can use wildcard here too: https://stackoverflow.com/a/28775709/1119169

	const Author = mongooseConnection.model('Author', authorSchema);

	const bookSchema = mongoose.Schema({
		title: String,
		isbn: String,
		created: {
			type: Date,
			default: Date.now
		}
	});

	// we defined apiValues response change to check if it works for refs response
	bookSchema.methods.apiValues = function() {
		const object = this.toObject({depopulate: true});
		object.isbn = 'hidden';

		return object;
	};
	const Book = mongooseConnection.model('Book', bookSchema);


	t.ok(mongooseConnection.models.Author);
	t.ok(mongooseConnection.models.Book);
});

test('clean up test collections', async t => {
	await mongooseConnection.models.Author.deleteMany({}).exec();
	await mongooseConnection.models.Book.deleteMany({}).exec();
});

test('schema ok', async t => {
	let book = new mongooseConnection.models.Book;
	book.title = 'The best book';
	book.isbn = 'The best isbn';

	await book.save();

	let book2 = new mongooseConnection.models.Book;
	book2.title = 'The best book2';
	book2.isbn = 'The best isbn2';

	await book2.save();

	let author = new mongooseConnection.models.Author;
	author.firstName = 'Jay';
	author.lastName = 'Kay';
	author.biography = 'Lived. Died.';
	author.inspired = [book, book2];

	await author.save();


	let authorFromDb = await mongooseConnection.models.Author.findOne({firstName: 'Jay'}).exec();
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'The best book'}).exec();
	let book2FromDb = await mongooseConnection.models.Book.findOne({title: 'The best book2'}).exec();

	t.ok(authorFromDb);
	t.ok(bookFromDb);
	t.ok(book2FromDb);

	await BackwardWrapper.populateDoc(authorFromDb.populate('inspired'));

	t.equal(''+authorFromDb.inspired[0]._id, ''+book._id);
	t.equal(''+authorFromDb.inspired[1]._id, ''+book2._id);
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

	t.equal(response.body.total, 2, 'API returns 2 books');
	t.equal(response.body.items[0].isbn, 'hidden', 'apiValues model method works');
	t.equal(response.body.items[1].isbn, 'hidden', 'apiValues model method works');

	response = await supertest(fastify.server)
		.get('/api/authors')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 1, 'API returns 1 author');
	t.equal(response.body.items.length, 1, 'API returns 1 author');
});


test('GET single item array Refs', async t => {
	let authorFromDb = await mongooseConnection.models.Author.findOne({firstName: 'Jay'}).exec();
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'The best book'}).exec();
	let book2FromDb = await mongooseConnection.models.Book.findOne({title: 'The best book2'}).exec();
	await BackwardWrapper.populateDoc(authorFromDb.populate('inspired'));

	let response = null;

	response = await supertest(fastify.server)
		.get('/api/books/'+bookFromDb._id+'/authors')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 1, 'API returns 1 refed author, inspired by this book');
	t.equal(response.body.items.length, 1, 'API returns 1 refed author');
	t.match(response.body.items[0], {firstName: 'Jay'}, "Refed author");

	response = await supertest(fastify.server)
		.get('/api/books/'+book2FromDb._id+'/authors')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 1, 'API returns 1 refed author, inspired by this book');
	t.equal(response.body.items.length, 1, 'API returns 1 refed author');
	t.match(response.body.items[0], {firstName: 'Jay'}, "Refed author");
});

test('GET single item with populated array field', async t => {
	let authorFromDb = await mongooseConnection.models.Author.findOne({firstName: 'Jay'}).exec();
	await BackwardWrapper.populateDoc(authorFromDb.populate('inspired'));


	let response = null;
	response = await supertest(fastify.server)
		.get('/api/authors/'+authorFromDb.id+'?populate=inspired')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')


	t.match(response.body, {firstName: 'Jay'}, "Single item data ok");
	t.equal(response.body.inspired.length, 2, "2 items in ref array");

	t.equal(response.body.inspired[0].isbn, 'hidden', 'apiValues model method works');
	t.equal(response.body.inspired[1].isbn, 'hidden', 'apiValues model method works');
});

// });

test('teardown', async t=>{
	await fastify.close();
	await mongooseConnection.close();
});