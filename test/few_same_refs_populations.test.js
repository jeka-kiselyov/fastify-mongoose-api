'use strict';

const fastifyMongooseAPI = require('../fastify-mongoose-api.js');

const t = require('tap');
const { test } = t;

const Fastify = require('fastify');
const mongoose = require('mongoose');

const MONGODB_URL =
    process.env.DATABASE_URI || 'mongodb://127.0.0.1/fastifymongooseapitest';

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
    authorSchema.index({
        firstName: 'text',
        lastName: 'text',
        biography: 'text'
    }); /// you can use wildcard here too: https://stackoverflow.com/a/28775709/1119169

    mongooseConnection.model('Author', authorSchema);

    const bookSchema = mongoose.Schema({
        title: String,
        isbn: String,
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Author'
        },
        coauthor: {
            /// testing multiple populate
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Author'
        },
        created: {
            type: Date,
            default: Date.now
        }
    });

    mongooseConnection.model('Book', bookSchema);

    t.ok(mongooseConnection.models.Author);
    t.ok(mongooseConnection.models.Book);
});

test('clean up test collections', async () => {
    await mongooseConnection.models.Author.deleteMany({}).exec();
    await mongooseConnection.models.Book.deleteMany({}).exec();
});

test('schema ok', async t => {
    let author = new mongooseConnection.models.Author();
    author.firstName = 'Jay';
    author.lastName = 'Kay';
    author.biography = 'Lived. Died.';

    await author.save();

    let coauthor = new mongooseConnection.models.Author();
    coauthor.firstName = 'Co';
    coauthor.lastName = 'Author';
    coauthor.biography = 'Nothing special';

    await coauthor.save();

    let book = new mongooseConnection.models.Book();
    book.title = 'The best book';
    book.isbn = 'The best isbn';
    book.author = author;
    book.coauthor = coauthor;

    await book.save();

    let authorFromDb = await mongooseConnection.models.Author.findOne({
        firstName: 'Jay'
    }).exec();
    let coauthorFromDb = await mongooseConnection.models.Author.findOne({
        firstName: 'Co'
    }).exec();
    let bookFromDb = await mongooseConnection.models.Book.findOne({
        title: 'The best book'
    }).exec();

    t.ok(authorFromDb);
    t.ok(coauthorFromDb);
    t.ok(bookFromDb);

    await BackwardWrapper.populateDoc(bookFromDb.populate('author'));
    // await bookFromDb.populate('author').execPopulate();

    t.equal('' + bookFromDb.author._id, '' + authorFromDb._id);

    await BackwardWrapper.populateDoc(bookFromDb.populate('coauthor'));
    // await bookFromDb.populate('coauthor').execPopulate();

    t.equal('' + bookFromDb.coauthor._id, '' + coauthorFromDb._id);
});

test('initialization of API server', async t => {
    ///// setting up the server
    fastify = Fastify();

    fastify.register(fastifyMongooseAPI, {
        models: mongooseConnection.models,
        prefix: '/api/',
        setDefaults: true,
        methods: ['list', 'get', 'post', 'patch', 'put', 'delete', 'options']
    });

    await fastify.ready();

    t.ok(fastify.mongooseAPI, 'mongooseAPI decorator is available');
    t.equal(
        Object.keys(fastify.mongooseAPI.apiRouters).length,
        2,
        'There are 2 APIRoutes, one for each model'
    );

    t.equal(
        fastify.mongooseAPI.apiRouters.Author.collectionName,
        'authors',
        'Collection name used in API path'
    );
    t.equal(
        fastify.mongooseAPI.apiRouters.Book.collectionName,
        'books',
        'Collection name used in API path'
    );

    t.equal(
        fastify.mongooseAPI.apiRouters.Author.path,
        '/api/authors',
        'API path is composed with prefix + collectionName'
    );
    t.equal(
        fastify.mongooseAPI.apiRouters.Book.path,
        '/api/books',
        'API path is composed with prefix + collectionName'
    );
});

test('GET collection endpoints', async t => {
    let response = null;
    response = await fastify.inject({
        method: 'GET',
        url: '/api/books'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.equal(response.json().total, 1, 'API returns 1 book');

    response = await fastify.inject({
        method: 'GET',
        url: '/api/authors'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.equal(response.json().total, 2, 'API returns 2 authors');
});

test('GET single item Refs', async t => {
    let bookFromDb = await mongooseConnection.models.Book.findOne({
        title: 'The best book'
    });
    // await bookFromDb.populate('author').populate('coauthor').execPopulate();
    await BackwardWrapper.populateDoc(
        bookFromDb.populate(['author', 'coauthor'])
    );

    let response = null;
    response = await fastify.inject({
        method: 'GET',
        url: '/api/books/' + bookFromDb.id + '/author'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.match(
        response.json(),
        {
            firstName: bookFromDb.author.firstName,
            lastName: bookFromDb.author.lastName
        },
        'Single item Ref ok'
    );
    t.match(
        response.json(),
        { _id: '' + bookFromDb.author.id },
        'Single item id ok'
    );

    response = null;
    response = await fastify.inject({
        method: 'GET',
        url: '/api/books/' + bookFromDb.id + '/coauthor'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.match(
        response.json(),
        {
            firstName: bookFromDb.coauthor.firstName,
            lastName: bookFromDb.coauthor.lastName
        },
        'Single item additional Ref ok'
    );
    t.match(
        response.json(),
        { _id: '' + bookFromDb.coauthor.id },
        'Single item additional ref id ok'
    );

    response = await fastify.inject({
        method: 'GET',
        url: '/api/authors/' + bookFromDb.author.id + '/books'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.equal(response.json().total, 1, 'API returns 1 refed book');
    t.equal(response.json().items.length, 1, 'API returns 1 refed book');
    t.match(
        response.json().items[0],
        { title: bookFromDb.title, isbn: bookFromDb.isbn },
        'Refed book'
    );

    response = await fastify.inject({
        method: 'GET',
        url: '/api/authors/' + bookFromDb.coauthor.id + '/books'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );
    t.equal(
        response.json().total,
        0,
        'API returns no books where coauthor is author'
    );
    t.equal(
        response.json().items.length,
        0,
        'API returns no books where coauthor is author'
    );

    /// extra refs routes
    response = await fastify.inject({
        method: 'GET',
        url: '/api/authors/' + bookFromDb.coauthor.id + '/books_as_coauthor'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );
    t.equal(response.json().total, 1, 'API returns 1 refed book as coauthor');
    t.equal(
        response.json().items.length,
        1,
        'API returns 1 refed book as coauthor'
    );
    t.match(
        response.json().items[0],
        { title: bookFromDb.title, isbn: bookFromDb.isbn },
        'Refed book'
    );
});

test('GET single item with populated field', async t => {
    let bookFromDb = await mongooseConnection.models.Book.findOne({
        title: 'The best book'
    });
    // await bookFromDb.populate('author').populate('coauthor').execPopulate();
    await BackwardWrapper.populateDoc(
        bookFromDb.populate(['author', 'coauthor'])
    );

    let response = null;
    response = await fastify.inject({
        method: 'GET',
        url: '/api/books/' + bookFromDb.id + '?populate=author'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );
    t.match(
        response.json(),
        { title: bookFromDb.title, isbn: bookFromDb.isbn },
        'Book is ok'
    );
    t.match(
        response.json().author,
        {
            firstName: bookFromDb.author.firstName,
            lastName: bookFromDb.author.lastName
        },
        'Populated author is ok'
    );
    t.match(
        response.json().author,
        { _id: '' + bookFromDb.author.id },
        'Populated author id is ok'
    );

    response = await fastify.inject({
        method: 'GET',
        url: '/api/books/' + bookFromDb.id + '?populate=coauthor'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );
    t.match(
        response.json(),
        { title: bookFromDb.title, isbn: bookFromDb.isbn },
        'Book is ok'
    );
    t.match(
        response.json().coauthor,
        {
            firstName: bookFromDb.coauthor.firstName,
            lastName: bookFromDb.coauthor.lastName
        },
        'Populated coauthor is ok'
    );
    t.match(
        response.json().coauthor,
        { _id: '' + bookFromDb.coauthor.id },
        'Populated coauthor id is ok'
    );

    /// few populations
    response = await fastify.inject({
        method: 'GET',
        url: '/api/books/' + bookFromDb.id,
        query: 'populate[]=coauthor&populate[]=author'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.match(
        response.json(),
        { title: bookFromDb.title, isbn: bookFromDb.isbn },
        'Book is ok'
    );
    t.match(
        response.json().coauthor,
        {
            firstName: bookFromDb.coauthor.firstName,
            lastName: bookFromDb.coauthor.lastName
        },
        'Populated coauthor is ok'
    );
    t.match(
        response.json().coauthor,
        { _id: '' + bookFromDb.coauthor.id },
        'Populated coauthor id is ok'
    );
    t.match(
        response.json().author,
        {
            firstName: bookFromDb.author.firstName,
            lastName: bookFromDb.author.lastName
        },
        'Populated author is ok'
    );
    t.match(
        response.json().author,
        { _id: '' + bookFromDb.author.id },
        'Populated author id is ok'
    );
});

test('GET collection with few populated', async t => {
    let bookFromDb = await mongooseConnection.models.Book.findOne({
        title: 'The best book'
    });
    // await bookFromDb.populate('author').populate('coauthor').execPopulate();
    await BackwardWrapper.populateDoc(
        bookFromDb.populate(['author', 'coauthor'])
    );

    let response = null;
    response = await fastify.inject({
        method: 'GET',
        url: '/api/books',
        query: 'populate[]=coauthor&populate[]=author'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );
    t.equal(response.json().total, 1, 'API returns 1 book');
    t.match(
        response.json().items[0].coauthor,
        { _id: '' + bookFromDb.coauthor.id },
        'Populated coauthor id is ok'
    );
    t.match(
        response.json().items[0].author,
        {
            firstName: bookFromDb.author.firstName,
            lastName: bookFromDb.author.lastName
        },
        'Populated author is ok'
    );
});

test('GET collection with single populated', async t => {
    let bookFromDb = await mongooseConnection.models.Book.findOne({
        title: 'The best book'
    });
    await BackwardWrapper.populateDoc(
        bookFromDb.populate(['author', 'coauthor'])
    );
    // await bookFromDb.populate('author').populate('coauthor').execPopulate();

    let response = null;
    response = await fastify.inject({
        method: 'GET',
        url: '/api/books?populate=coauthor'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );
    t.equal(response.json().total, 1, 'API returns 1 book');
    t.match(
        response.json().items[0].coauthor,
        { _id: '' + bookFromDb.coauthor.id },
        'Populated coauthor id is ok'
    );
    t.equal(
        response.json().items[0].author,
        '' + bookFromDb.author.id,
        'Author was not populated, there is just id'
    );
});

test('POST item with ref test', async t => {
    let bookFromDb = await mongooseConnection.models.Book.findOne({
        title: 'The best book'
    });
    // await bookFromDb.populate('author').populate('coauthor').execPopulate();
    await BackwardWrapper.populateDoc(
        bookFromDb.populate(['author', 'coauthor'])
    );

    let response = null;
    response = await fastify.inject({
        method: 'POST',
        url: '/api/books',
        payload: {
            title: 'Another One',
            isbn: 'isbn',
            author: '' + bookFromDb.author.id,
            coauthor: '' + bookFromDb.coauthor.id
        }
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );
    t.match(
        response.json(),
        {
            title: 'Another One',
            isbn: 'isbn',
            author: '' + bookFromDb.author.id,
            coauthor: '' + bookFromDb.coauthor.id
        },
        'POST api ok'
    );

    response = await fastify.inject({
        method: 'GET',
        url: '/api/authors/' + bookFromDb.author.id + '/books'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.equal(response.json().total, 2, 'API returns 2 refed books');
    t.equal(response.json().items.length, 2, 'API returns 2 refed books');

    response = await fastify.inject({
        method: 'GET',
        url: '/api/authors/' + bookFromDb.coauthor.id + '/books_as_coauthor'
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.equal(response.json().total, 2, 'API returns 2 refed books as_coauthor');
    t.equal(
        response.json().items.length,
        2,
        'API returns 2 refed books as_coauthor'
    );
});

test('PATCH item test', async t => {
    let bookFromDb = await mongooseConnection.models.Book.findOne({
        title: 'The best book'
    });
    // await bookFromDb.populate('author').populate('coauthor').execPopulate();
    await BackwardWrapper.populateDoc(
        bookFromDb.populate(['author', 'coauthor'])
    );

    let response = null;
    response = await fastify.inject({
        method: 'PATCH',
        url: '/api/books/' + bookFromDb.id,
        payload: {
            title: 'The best book patched',
            isbn: 'The best isbn patched'
        }
    });

    t.equal(response.statusCode, 200, 'PATCH api ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Response has correct content type'
    );

    t.match(
        response.json(),
        {
            title: 'The best book patched',
            isbn: 'The best isbn patched',
            author: '' + bookFromDb.author.id
        },
        'PUT api ok'
    );
    t.match(
        response.json(),
        { author: '' + bookFromDb.author.id },
        'Author still refs to original'
    );
    t.match(
        response.json(),
        { coauthor: '' + bookFromDb.coauthor.id },
        'coAuthor still refs to original'
    );
});

test('PUT item test', async t => {
    let bookFromDb = await mongooseConnection.models.Book.findOne({
        title: 'The best book patched'
    });
    // await bookFromDb.populate('author').execPopulate();
    await BackwardWrapper.populateDoc(bookFromDb.populate('author'));

    let response = null;
    response = await fastify.inject({
        method: 'PUT',
        url: '/api/books/' + bookFromDb.id,
        payload: {
            title: 'The best book updated',
            isbn: 'The best isbn updated'
        }
    });

    t.equal(response.statusCode, 200, 'PUT api ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Response has correct content type'
    );

    t.match(
        response.json(),
        {
            title: 'The best book updated',
            isbn: 'The best isbn updated',
            author: '' + bookFromDb.author.id
        },
        'PUT api ok'
    );
    t.match(
        response.json(),
        { author: '' + bookFromDb.author.id },
        'Author still refs to original'
    );
});

test('DELETE item test', async t => {
    let bookFromDb = await mongooseConnection.models.Book.findOne({
        title: 'The best book updated'
    });
    // await bookFromDb.populate('author').populate('coauthor').execPopulate();
    await BackwardWrapper.populateDoc(
        bookFromDb.populate(['author', 'coauthor'])
    );
    bookFromDb.author;

    let response = null;
    response = await fastify.inject({
        method: 'DELETE',
        url: '/api/books/' + bookFromDb.id
    });

    t.equal(response.statusCode, 200, 'DELETE api ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Response has correct content type'
    );

    t.match(response.json(), { success: true }, 'DELETE api ok');

    response = await fastify.inject({
        method: 'GET',
        url: '/api/authors/' + bookFromDb.author.id + '/books'
    });

    t.equal(response.statusCode, 200, 'GET api ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Response has correct content type'
    );

    t.equal(response.json().total, 1, 'API returns 1 refed books after delete');
    t.equal(
        response.json().items.length,
        1,
        'API returns 1 refed books after delete'
    );

    response = await fastify.inject({
        method: 'GET',
        url: '/api/authors/' + bookFromDb.coauthor.id + '/books_as_coauthor'
    });

    t.equal(response.statusCode, 200, 'GET api ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Response has correct content type'
    );

    t.equal(
        response.json().total,
        1,
        'API returns 1 refed books as_coauthor after delete'
    );
    t.equal(
        response.json().items.length,
        1,
        'API returns 1 refed books as_coauthor after delete'
    );
});

test('POST item and return populated response test', async t => {
    let bookFromDb = await mongooseConnection.models.Book.findOne({
        title: 'Another One'
    });
    // await bookFromDb.populate('author').populate('coauthor').execPopulate();
    await BackwardWrapper.populateDoc(
        bookFromDb.populate(['author', 'coauthor'])
    );

    let response = null;
    response = await fastify.inject({
        method: 'POST',
        url: '/api/books?populate[]=author&populate[]=coauthor',
        payload: {
            title: 'The populated book',
            isbn: 'isbn',
            author: '' + bookFromDb.author.id,
            coauthor: '' + bookFromDb.coauthor.id
        }
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.match(
        response.json(),
        { title: 'The populated book', isbn: 'isbn' },
        'POST api ok'
    );
    t.match(
        response.json().author,
        {
            firstName: bookFromDb.author.firstName,
            lastName: bookFromDb.author.lastName
        },
        'Populated author is ok'
    );
    t.match(
        response.json().author,
        { _id: '' + bookFromDb.author.id },
        'Populated author id is ok'
    );
});

test('PUT item and return populated response test', async t => {
    let bookFromDb = await mongooseConnection.models.Book.findOne({
        title: 'The populated book'
    });
    // await bookFromDb.populate('author').execPopulate();
    await BackwardWrapper.populateDoc(bookFromDb.populate('author'));

    let response = null;
    response = await fastify.inject({
        method: 'PUT',
        url: '/api/books/' + bookFromDb.id + '?populate=author',
        payload: { title: 'The populated book updated', isbn: 'isbn updated' }
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.match(
        response.json(),
        { title: 'The populated book updated', isbn: 'isbn updated' },
        'PUT api ok'
    );
    t.match(
        response.json().author,
        {
            firstName: bookFromDb.author.firstName,
            lastName: bookFromDb.author.lastName
        },
        'Populated author is ok'
    );
});

test('teardown', async () => {
    await fastify.close();
    await mongooseConnection.close();
});
