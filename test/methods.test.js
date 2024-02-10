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

let schema = {
    firstName: String,
    lastName: String
};
let _id = null;

test('mongoose db initialization', async t => {
    t.plan(2);

    mongooseConnection = await BackwardWrapper.createConnection(MONGODB_URL);
    t.ok(mongooseConnection);
    t.equal(mongooseConnection.readyState, 1, 'Ready state is connected(==1)'); /// connected
});

test('schema initialization', async t => {
    const authorSchema = mongoose.Schema(schema);

    mongooseConnection.model('Author', authorSchema);

    t.ok(mongooseConnection.models.Author);
});

test('clean up test collections', async () => {
    await mongooseConnection.models.Author.deleteMany({}).exec();
});

test('initialization of API server', async t => {
    ///// setting up the server
    fastify = Fastify();

    fastify.register(fastifyMongooseAPI, {
        models: mongooseConnection.models,
        setDefaults: true
    });

    await fastify.ready();

    t.strictSame(
        fastify.mongooseAPI._methods,
        ['list', 'get', 'post', 'patch', 'put', 'delete'],
        'mongooseAPI defaults methods loaded'
    );
});

test('POST item test', async t => {
    let response = null;
    response = await fastify.inject({
        method: 'POST',
        url: '/api/authors',
        payload: { firstName: 'Hutin', lastName: 'Puylo' }
    });

    t.equal(response.statusCode, 200, 'POST api ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8'
    );

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

    response = await fastify.inject({
        method: 'GET',
        url: '/api/authors'
    });

    t.equal(response.statusCode, 200, 'GET api ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8'
    );

    t.match(
        response.json().items[0],
        { firstName: 'Hutin', lastName: 'Puylo' },
        'Listed same'
    );
    t.equal(response.json().total, 1, 'There are author now');
});

test('Shutdown API server', async () => {
    await fastify.close();
});

test('initialization of API server with limited methods', async t => {
    ///// setting up the server
    fastify = Fastify();

    fastify.register(fastifyMongooseAPI, {
        models: mongooseConnection.models,
        setDefaults: true,
        methods: ['list', 'get'] // read-only
    });

    await fastify.ready();

    t.strictSame(
        fastify.mongooseAPI._methods,
        ['list', 'get'],
        'mongooseAPI custom methods loaded'
    );
});

test('POST item is invalid', async t => {
    let response = null;
    response = await fastify.inject({
        method: 'POST',
        url: '/api/authors',
        payload: { firstName: 'Hutin', lastName: 'Puylo' }
    });

    t.equal(response.statusCode, 404, 'POST denied');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Content-Type is correct'
    );

    t.match(
        response.json().message,
        'Route POST:/api/authors not found',
        'POST denied'
    );
});

test('GET is valid', async t => {
    let response = null;
    response = await fastify.inject({
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
    let response = null;
    response = await fastify.inject({
        method: 'GET',
        url: '/api/authors'
    });

    t.equal(response.statusCode, 200, 'GET is valid');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Content-Type is correct'
    );

    t.match(
        response.json().items[0],
        { firstName: 'Hutin', lastName: 'Puylo' },
        'Listed same'
    );
    t.equal(response.json().total, 1, 'There are author now');
});

test('teardown', async () => {
    await fastify.close();
    await mongooseConnection.close();
});
