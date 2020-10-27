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


let mongooseConnection = null;
let fastify = null;

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
	    coauthor: { /// testing multiple populate
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

	let coauthor = new mongooseConnection.models.Author;
	coauthor.firstName = 'Co';
	coauthor.lastName = 'Author';
	coauthor.biography = 'Nothing special';

	await coauthor.save();

	let book = new mongooseConnection.models.Book;
	book.title = 'The best book';
	book.isbn = 'The best isbn';
	book.author = author;
	book.coauthor = coauthor;

	await book.save();

	let authorFromDb = await mongooseConnection.models.Author.findOne({firstName: 'Jay'}).exec();
	let coauthorFromDb = await mongooseConnection.models.Author.findOne({firstName: 'Co'}).exec();
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'The best book'}).exec();

	t.ok(authorFromDb);
	t.ok(coauthorFromDb);
	t.ok(bookFromDb);

	await bookFromDb.populate('author').execPopulate();

	t.equal(''+bookFromDb.author._id, ''+authorFromDb._id);

	await bookFromDb.populate('coauthor').execPopulate();

	t.equal(''+bookFromDb.coauthor._id, ''+coauthorFromDb._id);
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

	t.equal(response.body.total, 1, 'API returns 1 book');

	response = await supertest(fastify.server)
		.get('/api/authors')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 2, 'API returns 2 authors');
});

test('GET single item Refs', async t => {
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'The best book'});
	await bookFromDb.populate('author').populate('coauthor').execPopulate();

	let response = null;
	response = await supertest(fastify.server)
		.get('/api/books/'+bookFromDb.id+'/author')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {firstName: bookFromDb.author.firstName, lastName: bookFromDb.author.lastName}, "Single item Ref ok");
	t.match(response.body, {_id: ''+bookFromDb.author.id}, "Single item id ok");

	response = null;
	response = await supertest(fastify.server)
		.get('/api/books/'+bookFromDb.id+'/coauthor')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {firstName: bookFromDb.coauthor.firstName, lastName: bookFromDb.coauthor.lastName}, "Single item additional Ref ok");
	t.match(response.body, {_id: ''+bookFromDb.coauthor.id}, "Single item additional ref id ok");

	response = await supertest(fastify.server)
		.get('/api/authors/'+bookFromDb.author.id+'/books')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 1, 'API returns 1 refed book');
	t.equal(response.body.items.length, 1, 'API returns 1 refed book');
	t.match(response.body.items[0], {title: bookFromDb.title, isbn: bookFromDb.isbn}, "Refed book");

	response = await supertest(fastify.server)
		.get('/api/authors/'+bookFromDb.coauthor.id+'/books')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 0, 'API returns no books where coauthor is author');
	t.equal(response.body.items.length, 0, 'API returns no books where coauthor is author');


	/// extra refs routes
	response = await supertest(fastify.server)
		.get('/api/authors/'+bookFromDb.coauthor.id+'/books_as_coauthor')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 1, 'API returns 1 refed book as coauthor');
	t.equal(response.body.items.length, 1, 'API returns 1 refed book as coauthor');
	t.match(response.body.items[0], {title: bookFromDb.title, isbn: bookFromDb.isbn}, "Refed book");
});

test('GET single item with populated field', async t => {
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'The best book'});
	await bookFromDb.populate('author').populate('coauthor').execPopulate();

	let response = null;
	response = await supertest(fastify.server)
		.get('/api/books/'+bookFromDb.id+'?populate=author')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {title: bookFromDb.title, isbn: bookFromDb.isbn}, "Book is ok");
	t.match(response.body.author, {firstName: bookFromDb.author.firstName, lastName: bookFromDb.author.lastName}, "Populated author is ok");
	t.match(response.body.author, {_id: ''+bookFromDb.author.id}, "Populated author id is ok");

	response = await supertest(fastify.server)
		.get('/api/books/'+bookFromDb.id+'?populate=coauthor')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {title: bookFromDb.title, isbn: bookFromDb.isbn}, "Book is ok");
	t.match(response.body.coauthor, {firstName: bookFromDb.coauthor.firstName, lastName: bookFromDb.coauthor.lastName}, "Populated coauthor is ok");
	t.match(response.body.coauthor, {_id: ''+bookFromDb.coauthor.id}, "Populated coauthor id is ok");

	/// few populations
	response = await supertest(fastify.server)
		.get('/api/books/'+bookFromDb.id+'?populate[]=coauthor&populate[]=author')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {title: bookFromDb.title, isbn: bookFromDb.isbn}, "Book is ok");
	t.match(response.body.coauthor, {firstName: bookFromDb.coauthor.firstName, lastName: bookFromDb.coauthor.lastName}, "Populated coauthor is ok");
	t.match(response.body.coauthor, {_id: ''+bookFromDb.coauthor.id}, "Populated coauthor id is ok");
	t.match(response.body.author, {firstName: bookFromDb.author.firstName, lastName: bookFromDb.author.lastName}, "Populated author is ok");
	t.match(response.body.author, {_id: ''+bookFromDb.author.id}, "Populated author id is ok");
});

test('POST item with ref test', async t => {
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'The best book'});
	await bookFromDb.populate('author').populate('coauthor').execPopulate();

	let response = null;
	response = await supertest(fastify.server)
		.post('/api/books')
		.send({title: 'Another One', isbn: 'isbn', author: ''+bookFromDb.author.id, coauthor: ''+bookFromDb.coauthor.id})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {title: 'Another One', isbn: 'isbn', author: ''+bookFromDb.author.id, coauthor: ''+bookFromDb.coauthor.id}, "POST api ok");

	response = await supertest(fastify.server)
		.get('/api/authors/'+bookFromDb.author.id+'/books')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 2, 'API returns 2 refed books');
	t.equal(response.body.items.length, 2, 'API returns 2 refed books');

	response = await supertest(fastify.server)
		.get('/api/authors/'+bookFromDb.coauthor.id+'/books_as_coauthor')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 2, 'API returns 2 refed books as_coauthor');
	t.equal(response.body.items.length, 2, 'API returns 2 refed books as_coauthor');
});

test('PATCH item test', async t => {
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'The best book'});
	await bookFromDb.populate('author').populate('coauthor').execPopulate();

	let response = null;
	response = await supertest(fastify.server)
		.patch('/api/books/'+bookFromDb.id)
		.send({title: 'The best book patched', isbn: 'The best isbn patched'})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {title: 'The best book patched', isbn: 'The best isbn patched', author: ''+bookFromDb.author.id}, "PUT api ok");
	t.match(response.body, {author: ''+bookFromDb.author.id}, "Author still refs to original");
	t.match(response.body, {coauthor: ''+bookFromDb.coauthor.id}, "coAuthor still refs to original");
});

test('PUT item test', async t => {
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'The best book patched'});
	await bookFromDb.populate('author').execPopulate();

	let response = null;
	response = await supertest(fastify.server)
		.put('/api/books/'+bookFromDb.id)
		.send({title: 'The best book updated', isbn: 'The best isbn updated'})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {title: 'The best book updated', isbn: 'The best isbn updated', author: ''+bookFromDb.author.id}, "PUT api ok");
	t.match(response.body, {author: ''+bookFromDb.author.id}, "Author still refs to original");
});

test('DELETE item test', async t => {
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'The best book updated'});
	await bookFromDb.populate('author').populate('coauthor').execPopulate();
	let author = bookFromDb.author;

	let response = null;
	response = await supertest(fastify.server)
		.delete('/api/books/'+bookFromDb.id)
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8');

	t.match(response.body, {success: true}, "DELETE api ok");

	response = await supertest(fastify.server)
		.get('/api/authors/'+bookFromDb.author.id+'/books')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 1, 'API returns 1 refed books after delete');
	t.equal(response.body.items.length, 1, 'API returns 1 refed books after delete');

	response = await supertest(fastify.server)
		.get('/api/authors/'+bookFromDb.coauthor.id+'/books_as_coauthor')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.equal(response.body.total, 1, 'API returns 1 refed books as_coauthor after delete');
	t.equal(response.body.items.length, 1, 'API returns 1 refed books as_coauthor after delete');
});

test('POST item and return populated response test', async t => {
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'Another One'});
	await bookFromDb.populate('author').populate('coauthor').execPopulate();

	let response = null;
	response = await supertest(fastify.server)
		.post('/api/books?populate[]=author&populate[]=coauthor')
		.send({title: 'The populated book', isbn: 'isbn', author: ''+bookFromDb.author.id, coauthor: ''+bookFromDb.coauthor.id})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {title: 'The populated book', isbn: 'isbn'}, "POST api ok");
	t.match(response.body.author, {firstName: bookFromDb.author.firstName, lastName: bookFromDb.author.lastName}, "Populated author is ok");
	t.match(response.body.author, {_id: ''+bookFromDb.author.id}, "Populated author id is ok");
});

test('PUT item and return populated response test', async t => {
	let bookFromDb = await mongooseConnection.models.Book.findOne({title: 'The populated book'});
	await bookFromDb.populate('author').execPopulate();

	let response = null;
	response = await supertest(fastify.server)
		.put('/api/books/'+bookFromDb.id+"?populate=author")
		.send({title: 'The populated book updated', isbn: 'isbn updated'})
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, {title: 'The populated book updated', isbn: 'isbn updated'}, "PUT api ok");
	t.match(response.body.author, {firstName: bookFromDb.author.firstName, lastName: bookFromDb.author.lastName}, "Populated author is ok");
});


test('teardown', async t=>{
	await fastify.close();
	await mongooseConnection.close();
});