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
        },
        inspired: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }] // store books author was inpired by
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
        created: {
            type: Date,
            default: Date.now
        }
    });

    // we defined apiValues response change to check if it works for refs response
    bookSchema.methods.apiValues = function () {
        const object = this.toObject({ depopulate: true });
        object.isbn = 'hidden';

        return object;
    };
    bw.conn.model('Book', bookSchema);

    t.ok(bw.conn.models.Author);
    t.ok(bw.conn.models.Book);
});

test('clean up test collections', async () => {
    await bw.conn.models.Author.deleteMany({}).exec();
    await bw.conn.models.Book.deleteMany({}).exec();
});

test('schema ok', async t => {
    let book = new bw.conn.models.Book();
    book.title = 'The best book';
    book.isbn = 'The best isbn';

    await book.save();

    let book2 = new bw.conn.models.Book();
    book2.title = 'The best book2';
    book2.isbn = 'The best isbn2';

    await book2.save();

    let author = new bw.conn.models.Author();
    author.firstName = 'Jay';
    author.lastName = 'Kay';
    author.biography = 'Lived. Died.';
    author.inspired = [book, book2];

    await author.save();

    let authorFromDb = await bw.conn.models.Author.findOne({
        firstName: 'Jay'
    }).exec();
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The best book'
    }).exec();
    let book2FromDb = await bw.conn.models.Book.findOne({
        title: 'The best book2'
    }).exec();

    t.ok(authorFromDb);
    t.ok(bookFromDb);
    t.ok(book2FromDb);

    await bw.populateDoc(authorFromDb.populate('inspired'));

    t.equal('' + authorFromDb.inspired[0]._id, '' + book._id);
    t.equal('' + authorFromDb.inspired[1]._id, '' + book2._id);
});

test('initialization of API server', async t => {
    await bw.createServer({
        models: bw.conn.models,
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

    t.equal(response.json().total, 2, 'API returns 2 books');
    t.equal(
        response.json().items[0].isbn,
        'hidden',
        'apiValues model method works'
    );
    t.equal(
        response.json().items[1].isbn,
        'hidden',
        'apiValues model method works'
    );

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors'
    });

    t.equal(response.json().total, 1, 'API returns 1 author');
    t.equal(response.json().items.length, 1, 'API returns 1 author');
});

test('GET single item array Refs', async t => {
    let authorFromDb = await bw.conn.models.Author.findOne({
        firstName: 'Jay'
    }).exec();
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The best book'
    }).exec();
    let book2FromDb = await bw.conn.models.Book.findOne({
        title: 'The best book2'
    }).exec();
    await bw.populateDoc(authorFromDb.populate('inspired'));

    let response = null;

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/books/' + bookFromDb._id + '/authors'
    });

    t.equal(
        response.json().total,
        1,
        'API returns 1 refed author, inspired by this book'
    );
    t.equal(response.json().items.length, 1, 'API returns 1 refed author');
    t.match(response.json().items[0], { firstName: 'Jay' }, 'Refed author');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/books/' + book2FromDb._id + '/authors'
    });

    t.equal(
        response.json().total,
        1,
        'API returns 1 refed author, inspired by this book'
    );
    t.equal(response.json().items.length, 1, 'API returns 1 refed author');
    t.match(response.json().items[0], { firstName: 'Jay' }, 'Refed author');
});

test('GET single item with populated array field', async t => {
    let authorFromDb = await bw.conn.models.Author.findOne({
        firstName: 'Jay'
    }).exec();
    await bw.populateDoc(authorFromDb.populate('inspired'));

    const response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors/' + authorFromDb.id + '?populate=inspired'
    });

    t.match(response.json(), { firstName: 'Jay' }, 'Single item data ok');
    t.equal(response.json().inspired.length, 2, '2 items in ref array');

    t.equal(
        response.json().inspired[0].isbn,
        'hidden',
        'apiValues model method works'
    );
    t.equal(
        response.json().inspired[1].isbn,
        'hidden',
        'apiValues model method works'
    );
});
