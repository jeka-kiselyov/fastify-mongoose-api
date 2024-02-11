'use strict';

const t = require('tap');
const { test } = t;

const mongoose = require('mongoose');
const BackwardWrapper = require('./BackwardWrapper.js');

const bw = new BackwardWrapper(t);

let isAuthedTestBoolean = false;

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

test('initialization of API server', async () => {
    await bw.createServer({
        models: bw.conn.models,
        prefix: '/api/',
        setDefaults: true,
        checkAuth: async () => {
            if (!isAuthedTestBoolean) {
                const e = new Error('401, honey!');
                e.statusCode = 401;
                throw e;
            }
        },
        methods: ['list', 'get', 'post', 'patch', 'put', 'delete', 'options']
    });
});

test('Test Auth (not)', async t => {
    let response = null;
    response = await bw.inject(
        t,
        {
            method: 'GET',
            url: '/api/books'
        },
        401
    );

    t.same(
        response.json(),
        { statusCode: 401, error: 'Unauthorized', message: '401, honey!' },
        'There is error and no data response'
    );

    response = await bw.inject(
        t,
        {
            method: 'GET',
            url: '/api/authors'
        },
        401
    );

    t.same(
        response.json(),
        { statusCode: 401, error: 'Unauthorized', message: '401, honey!' },
        'There is error and no data response'
    );
});

test('Test Auth (authed)', async t => {
    //// sign in
    isAuthedTestBoolean = true;
    ////

    let response = null;
    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/books'
    });

    t.match(response.json(), { total: 0 }, 'There is response');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors'
    });

    t.match(response.json(), { total: 0 }, 'There is response');
});
