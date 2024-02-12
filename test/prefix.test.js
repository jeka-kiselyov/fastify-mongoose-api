'use strict';

const t = require('tap');
const { test } = t;

const mongoose = require('mongoose');
const BackwardWrapper = require('./BackwardWrapper.js');

const bw = new BackwardWrapper(t);

test('mongoose db initialization', async () => {
    await bw.createConnection();
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

    bw.conn.model('Author', authorSchema);

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

    bw.conn.model('Book', bookSchema);

    t.ok(bw.conn.models.Author);
    t.ok(bw.conn.models.Book);
});

test('clean up test collections', async () => {
    await bw.conn.models.Author.deleteMany({}).exec();
    await bw.conn.models.Book.deleteMany({}).exec();
});

test('schema ok', async t => {
    let author = new bw.conn.models.Author();
    author.firstName = 'Jay';
    author.lastName = 'Kay';
    author.biography = 'Lived. Died.';

    await author.save();

    let book = new bw.conn.models.Book();
    book.title = 'The best book';
    book.isbn = 'The best isbn';
    book.author = author;

    await book.save();

    let authorFromDb = await bw.conn.models.Author.findOne({
        firstName: 'Jay'
    });
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The best book'
    });

    t.ok(authorFromDb);
    t.ok(bookFromDb);

    await bw.populateDoc(bookFromDb.populate('author'));
    // await bookFromDb.populate('author').execPopulate();

    t.equal('' + bookFromDb.author._id, '' + authorFromDb._id);
});

test('initialization of API server', async t => {
    await bw.createServer({
        models: bw.conn.models,
        prefix: '/someroute/',
        setDefaults: true,
        methods: ['list', 'get', 'post', 'patch', 'put', 'delete', 'options']
    });
    t.equal(
        Object.keys(bw.fastify.mongooseAPI.apiRouters).length,
        2,
        'There are 2 APIRoutes, one for each model'
    );

    t.equal(
        bw.fastify.mongooseAPI.apiRouters.Author.collectionName,
        'authors',
        'Collection name used in API path'
    );
    t.equal(
        bw.fastify.mongooseAPI.apiRouters.Book.collectionName,
        'books',
        'Collection name used in API path'
    );

    t.equal(
        bw.fastify.mongooseAPI.apiRouters.Author.path,
        '/someroute/authors',
        'API path is composed with prefix + collectionName'
    );
    t.equal(
        bw.fastify.mongooseAPI.apiRouters.Book.path,
        '/someroute/books',
        'API path is composed with prefix + collectionName'
    );
});

test('GET collection endpoints', async t => {
    let response = null;
    response = await bw.inject(t, {
        method: 'GET',
        url: '/someroute/books'
    });

    t.equal(response.json().total, 1, 'API returns 1 book');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/someroute/authors'
    });

    t.equal(response.json().total, 1, 'API returns 1 author');
});
