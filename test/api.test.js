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

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors'
    });

    t.equal(response.json().total, 1, 'API returns 1 author');
});

test('POST item test', async t => {
    let response = null;
    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/authors',
        payload: {
            firstName: 'Hutin',
            lastName: 'Puylo',
            biography: 'The Little One'
        }
    });

    t.match(
        response.json(),
        { firstName: 'Hutin', lastName: 'Puylo', biography: 'The Little One' },
        'POST api ok'
    );

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors'
    });

    t.equal(response.json().total, 2, 'There are two authors now');
});

test('GET collection filtering', async t => {
    const response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors',
        query: { filter: 'lastName=Puylo' }
    });

    t.equal(response.json().total, 1, 'API returns 1 filtered author');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered author');
    t.match(
        response.json().items[0],
        { firstName: 'Hutin', lastName: 'Puylo', biography: 'The Little One' },
        'Filtered author'
    );
});

test('GET collection search', async t => {
    const response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors',
        query: { search: 'One Little' }
    });

    t.equal(response.json().total, 1, 'API returns 1 searched author');
    t.equal(response.json().items.length, 1, 'API returns 1 searched author');
    t.match(
        response.json().items[0],
        { firstName: 'Hutin', lastName: 'Puylo', biography: 'The Little One' },
        'Filtered author'
    );
});

test('GET collection regex match', async t => {
    const response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors',
        query: { match: 'lastName=Puy' }
    });

    t.equal(response.json().total, 1, 'API returns 1 searched author');
    t.equal(response.json().items.length, 1, 'API returns 1 searched author');
    t.match(
        response.json().items[0],
        { firstName: 'Hutin', lastName: 'Puylo', biography: 'The Little One' },
        'Filtered author'
    );
});

test('GET collection case-insensitive regex match', async t => {
    const response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors',
        query: { match: 'lastName=(?i)puy' }
    });

    t.equal(response.json().total, 1, 'API returns 1 searched author');
    t.equal(response.json().items.length, 1, 'API returns 1 searched author');
    t.match(
        response.json().items[0],
        { firstName: 'Hutin', lastName: 'Puylo', biography: 'The Little One' },
        'Filtered author'
    );
});

test('GET collection sorting', async t => {
    let response = null;

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors',
        query: { sort: 'created' }
    });

    t.equal(response.json().total, 2, 'API returns 2 sorted authors');
    t.equal(response.json().items.length, 2, 'API returns 2 sorted authors');
    t.match(response.json().items[0], { firstName: 'Jay' }, 'The oldest first');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors',
        query: { sort: '-created' }
    });

    t.equal(response.json().total, 2, 'API returns 2 sorted authors');
    t.equal(response.json().items.length, 2, 'API returns 2 sorted authors');
    t.match(
        response.json().items[0],
        { firstName: 'Hutin' },
        'Most recent first'
    );
});

test('GET collection pagination', async t => {
    let response = null;

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors',
        query: { limit: 1, offset: 0, sort: '-created' }
    });

    t.equal(response.json().total, 2, 'Total is everything');
    t.equal(response.json().items.length, 1, 'Returned is paginated');
    t.match(
        response.json().items[0],
        { firstName: 'Hutin' },
        'Most recent is on the first page'
    );

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors',
        query: { limit: 1, offset: 1, sort: '-created' }
    });

    t.equal(response.json().total, 2, 'Total is everything');
    t.equal(response.json().items.length, 1, 'Returned is paginated');
    t.match(
        response.json().items[0],
        { firstName: 'Jay' },
        'Older is on the second page'
    );
});

test('GET collection projection', async t => {
    let response = null;

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors',
        query: { fields: 'firstName,lastName' }
    });

    t.equal(response.json().total, 2, 'Total is everything');
    t.equal(response.json().items.length, 2, 'API returns everything');
    t.same(
        Object.keys(response.json().items[0]),
        ['_id', 'firstName', 'lastName'],
        'Only contains projection and _id'
    );
    t.same(
        Object.keys(response.json().items[1]),
        ['_id', 'firstName', 'lastName'],
        'Only contains projection and _id'
    );

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors',
        query: { fields: '-firstName,-lastName,-__v' }
    });

    t.equal(response.json().total, 2, 'Total is everything');
    t.equal(response.json().items.length, 2, 'API returns everything');
    t.same(
        Object.keys(response.json().items[0]).sort(),
        ['_id', 'created', 'biography'].sort(),
        'Exclude projection fields'
    );
    t.same(
        Object.keys(response.json().items[1]).sort(),
        ['_id', 'created', 'biography'].sort(),
        'Exclude projection fields'
    );

    response = await bw.inject(
        t,
        {
            method: 'GET',
            url: '/api/authors',
            query: { fields: '-firstName,lastName' }
        },
        500
    );
});

test('GET single item', async t => {
    let authorFromDb = await bw.conn.models.Author.findOne({
        firstName: 'Jay'
    });
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The best book'
    });

    let response = null;
    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/books/' + bookFromDb.id,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

    t.match(
        response.json(),
        { title: 'The best book', isbn: 'The best isbn' },
        'Single item data ok'
    );
    t.match(response.json(), { _id: bookFromDb.id }, 'Single item id ok');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors/' + authorFromDb.id,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

    t.match(response.json(), { firstName: 'Jay' }, 'Single item data ok');
    t.match(response.json(), { _id: authorFromDb.id }, 'Single item id ok');
});

test('GET single item 404', async t => {
    await bw.inject(
        t,
        {
            method: 'GET',
            url: '/api/books/SOMEWRONGID',
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        },
        404
    );
});

test('GET single item Refs', async t => {
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The best book'
    });
    await bw.populateDoc(bookFromDb.populate('author'));

    let response = null;
    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/books/' + bookFromDb.id + '/author',
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

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

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors/' + bookFromDb.author.id + '/books',
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

    t.equal(response.json().total, 1, 'API returns 1 refed book');
    t.equal(response.json().items.length, 1, 'API returns 1 refed book');
    t.match(
        response.json().items[0],
        { title: bookFromDb.title, isbn: bookFromDb.isbn },
        'Refed book'
    );
});

test('GET single item with populated field', async t => {
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The best book'
    });
    await bw.populateDoc(bookFromDb.populate('author'));

    let response = null;
    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/books/' + bookFromDb.id + '?populate=author',
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

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
});

test('POST item with ref test', async t => {
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The best book'
    });
    await bw.populateDoc(bookFromDb.populate('author'));

    let response = null;
    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/books',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        payload: JSON.stringify({
            title: 'Another One',
            isbn: 'isbn',
            author: '' + bookFromDb.author.id
        })
    });

    t.match(
        response.json(),
        {
            title: 'Another One',
            isbn: 'isbn',
            author: '' + bookFromDb.author.id
        },
        'POST api ok'
    );

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors/' + bookFromDb.author.id + '/books',
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

    t.equal(response.json().total, 2, 'API returns 2 refed books');
    t.equal(response.json().items.length, 2, 'API returns 2 refed books');
});

test('PATCH item test', async t => {
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The best book'
    });
    await bw.populateDoc(bookFromDb.populate('author'));

    const response = await bw.inject(t, {
        method: 'PATCH',
        url: '/api/books/' + bookFromDb.id,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        payload: JSON.stringify({
            title: 'The best book patched',
            isbn: 'The best isbn patched'
        })
    });

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
});

test('PATCH single item 404', async t => {
    await bw.inject(
        t,
        {
            method: 'PATCH',
            url: '/api/books/SOMEWRONGID',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: {
                title: 'The best book patched',
                isbn: 'The best isbn patched'
            }
        },
        404
    );
});

test('PUT item test', async t => {
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The best book patched'
    });
    await bw.populateDoc(bookFromDb.populate('author'));

    const response = await bw.inject(t, {
        method: 'PUT',
        url: '/api/books/' + bookFromDb.id,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        payload: JSON.stringify({
            title: 'The best book updated',
            isbn: 'The best isbn updated'
        })
    });

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

test('PUT single item 404', async t => {
    await bw.inject(
        t,
        {
            method: 'PUT',
            url: '/api/books/SOMEWRONGID',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: {
                title: 'The best book updated',
                isbn: 'The best isbn updated'
            }
        },
        404
    );
});

test('DELETE item test', async t => {
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The best book updated'
    });
    await bw.populateDoc(bookFromDb.populate('author'));
    bookFromDb.author;

    let response = null;
    response = await bw.inject(t, {
        method: 'DELETE',
        url: '/api/books/' + bookFromDb.id,
        body: { id: bookFromDb.id }, // https://github.com/fastify/fastify/pull/5419
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

    t.match(response.json(), { success: true }, 'DELETE api ok');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors/' + bookFromDb.author.id + '/books',
        body: { id: bookFromDb.id }, // https://github.com/fastify/fastify/pull/5419
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });

    t.equal(response.json().total, 1, 'API returns 1 refed books after delete');
    t.equal(
        response.json().items.length,
        1,
        'API returns 1 refed books after delete'
    );
});

test('DELETE single item 404', async t => {
    await bw.inject(
        t,
        {
            method: 'DELETE',
            url: '/api/books/SOMEWRONGID',
            body: { id: 'SOMEWRONGID' }, // https://github.com/fastify/fastify/pull/5419
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        },
        404
    );
    await bw.inject(
        t,
        {
            method: 'DELETE',
            url: '/api/books/SOMEWRONGID',
            body: {}, // https://github.com/fastify/fastify/pull/5419
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        },
        404
    );
});

test('POST item and return populated response test', async t => {
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'Another One'
    });
    await bw.populateDoc(bookFromDb.populate('author'));

    const response = await bw.inject(t, {
        method: 'POST',
        url: '/api/books?populate=author',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        payload: JSON.stringify({
            title: 'The populated book',
            isbn: 'isbn',
            author: '' + bookFromDb.author.id
        })
    });

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
    let bookFromDb = await bw.conn.models.Book.findOne({
        title: 'The populated book'
    });
    await bw.populateDoc(bookFromDb.populate('author'));

    const response = await bw.inject(t, {
        method: 'PUT',
        url: '/api/books/' + bookFromDb.id + '?populate=author',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        payload: JSON.stringify({
            title: 'The populated book updated',
            isbn: 'isbn updated'
        })
    });

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
