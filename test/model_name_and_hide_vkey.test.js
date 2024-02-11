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
    }).exec();
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The best book'
    }).exec();

    t.ok(authorFromDb);
    t.ok(bookFromDb);

    await bw.populateDoc(bookFromDb.populate('author'));

    t.equal('' + bookFromDb.author._id, '' + authorFromDb._id);
});

test('initialization of API server', async t => {
    await bw.createServer({
        models: bw.conn.models,
        exposeVersionKey: false,
        exposeModelName: true,
        prefix: '/api/',
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
        '/api/authors',
        'API path is composed with prefix + collectionName'
    );
    t.equal(
        bw.fastify.mongooseAPI.apiRouters.Book.path,
        '/api/books',
        'API path is composed with prefix + collectionName'
    );
});

test('GET collection endpoints', async t => {
    let response = null;
    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/books'
    });

    t.equal(response.json().total, 1, 'API returns 1 book');
    t.equal(
        response.json().items[0].__modelName,
        'Book',
        'Model name is present in response'
    );

    t.has(
        response.json().items[0],
        { __v: undefined },
        'does not have version field'
    );

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors'
    });

    t.equal(response.json().total, 1, 'API returns 1 author');
    t.equal(response.json().items.length, 1, 'API returns 1 author');
    t.equal(
        response.json().items[0].__modelName,
        'Author',
        'Model name is present in response'
    );

    t.has(
        response.json().items[0],
        { __v: undefined },
        'does not have version field'
    );
});

test('ModelName on populated', async t => {
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The best book'
    });
    // await bookFromDb.populate('author').execPopulate();
    await bw.populateDoc(bookFromDb.populate('author'));

    const response = await bw.inject(t, {
        method: 'GET',
        url: '/api/books/' + bookFromDb.id + '?populate=author'
    });

    t.match(
        response.json(),
        { title: bookFromDb.title, isbn: bookFromDb.isbn },
        'Book is ok'
    );
    t.equal(
        response.json().__modelName,
        'Book',
        'Model name is present in response'
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
    t.equal(
        response.json().author.__modelName,
        'Author',
        'Model name is present in response on populated objects'
    );

    t.has(
        response.json().author,
        { __v: undefined },
        'populated does not have version field'
    );
});
