'use strict';

const t = require('tap');
const { test } = t;

const mongoose = require('mongoose');
const BackwardWrapper = require('./BackwardWrapper.js');

const bw = new BackwardWrapper(t);

let schema = {
    firstName: String,
    lastName: String
};
let _id = null;

test('mongoose db initialization', async () => {
    await bw.createConnection();
});

test('schema initialization', async t => {
    const authorSchema = mongoose.Schema(schema);

    bw.conn.model('Author', authorSchema);

    t.ok(bw.conn.models.Author);
});

test('clean up test collections', async () => {
    await bw.conn.models.Author.deleteMany({}).exec();
});

test('initialization of API server', async t => {
    await bw.createServer({
        models: bw.conn.models,
        setDefaults: true
    });

    t.strictSame(
        bw.fastify.mongooseAPI._methods,
        ['list', 'get', 'post', 'patch', 'put', 'delete'],
        'mongooseAPI defaults methods loaded'
    );
});

test('POST item test', async t => {
    let response = null;
    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/authors',
        payload: { firstName: 'Hutin', lastName: 'Puylo' }
    });

    const responseBody = response.json();
    t.equal(responseBody.firstName, 'Hutin');
    t.equal(responseBody.lastName, 'Puylo');
    t.match(
        responseBody,
        { firstName: 'Hutin', lastName: 'Puylo' },
        'POST api ok'
    );
    _id = responseBody._id;
    t.ok(_id, '_id generated');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors'
    });

    t.match(
        response.json().items[0],
        { firstName: 'Hutin', lastName: 'Puylo' },
        'Listed same'
    );
    t.equal(response.json().total, 1, 'There are author now');
});

test('Shutdown API server', async () => {
    await bw.fastify.close();
});

test('initialization of API server with limited methods', async t => {
    await bw.createServer({
        models: bw.conn.models,
        setDefaults: true,
        methods: ['list', 'get'] // read-only
    });

    t.strictSame(
        bw.fastify.mongooseAPI._methods,
        ['list', 'get'],
        'mongooseAPI custom methods loaded'
    );
});

test('POST item is invalid', async t => {
    const response = await bw.inject(
        t,
        {
            method: 'POST',
            url: '/api/authors',
            payload: { firstName: 'Hutin', lastName: 'Puylo' }
        },
        404
    );

    t.match(
        response.json().message,
        'Route POST:/api/authors not found',
        'POST denied'
    );
});

test('GET is valid', async t => {
    const response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors/' + _id
    });

    t.equal(response.statusCode, 200, 'GET is valid');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Content-Type is correct'
    );

    t.match(
        response.json(),
        { firstName: 'Hutin', lastName: 'Puylo' },
        'Item found'
    );
});

test('LIST is valid', async t => {
    const response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors'
    });

    t.match(
        response.json().items[0],
        { firstName: 'Hutin', lastName: 'Puylo' },
        'Listed same'
    );
    t.equal(response.json().total, 1, 'There are author now');
});
