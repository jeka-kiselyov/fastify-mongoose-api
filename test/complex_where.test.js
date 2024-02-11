'use strict';

const fastifyMongooseAPI = require('../fastify-mongoose-api.js');

const t = require('tap');
const { test } = t;

const Fastify = require('fastify');
const mongoose = require('mongoose');

// eslint-disable-next-line no-undef
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
    const schema = mongoose.Schema({
        name: String,
        appleCount: Number,
        bananaCount: Number
    });

    mongooseConnection.model('WhereTest', schema);
    t.ok(mongooseConnection.models.WhereTest);
});

test('clean up test collections', async () => {
    await mongooseConnection.models.WhereTest.deleteMany({}).exec();
});

test('initialization of API server', async t => {
    ///// setting up the server
    fastify = Fastify();

    fastify.register(fastifyMongooseAPI, {
        models: mongooseConnection.models
    });

    await fastify.ready();

    t.ok(fastify.mongooseAPI, 'mongooseAPI decorator is available');
    t.equal(
        fastify.mongooseAPI.apiRouters.WhereTest.collectionName,
        'wheretests',
        'Collection name used in API path'
    );
});

const bob = { name: 'Bob', appleCount: 1, bananaCount: 2 };
const rob = { name: 'Rob', appleCount: 2, bananaCount: 3 };
const alice = { name: 'Alice', appleCount: 50, bananaCount: 90 };

test('POST item test', async t => {
    let response = null;

    response = await fastify.inject({
        method: 'POST',
        url: '/api/wheretests',
        payload: bob
    });

    t.equal(response.statusCode, 200, 'POST api ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Content-Type is correct'
    );

    t.match(response.json(), bob, 'POST api ok');

    response = await fastify.inject({
        method: 'POST',
        url: '/api/wheretests',
        payload: rob
    });

    t.equal(response.statusCode, 200, 'POST api ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Content-Type is correct'
    );

    t.match(response.json(), rob, 'POST api ok');

    response = await fastify.inject({
        method: 'POST',
        url: '/api/wheretests',
        payload: alice
    });

    t.equal(response.statusCode, 200, 'POST api ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Content-Type is correct'
    );

    t.match(response.json(), alice, 'POST api ok');

    response = await fastify.inject({
        method: 'GET',
        url: '/api/wheretests'
    });

    t.equal(response.statusCode, 200, 'GET api ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Content-Type is correct'
    );

    t.equal(response.json().total, 3, 'There re 3 banana holders');
});

test('GET collection complex where', async t => {
    let response = null;

    response = await fastify.inject({
        method: 'GET',
        url: '/api/wheretests',
        query: { where: '{"bananaCount": 2}' }
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.equal(response.json().total, 1, 'API returns 1 filtered');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered');
    t.match(response.json().items[0], bob, 'Filtered');

    response = await fastify.inject({
        method: 'GET',
        url: '/api/wheretests',
        query: { where: JSON.stringify({ appleCount: { $gt: 10 } }) }
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.equal(response.json().total, 1, 'API returns 1 filtered');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered');
    t.match(response.json().items[0], alice, 'Filtered');

    response = await fastify.inject({
        method: 'GET',
        url: '/api/wheretests',
        query: {
            where: JSON.stringify({
                $and: [{ appleCount: { $gt: 1 } }, { bananaCount: { $lt: 5 } }]
            })
        }
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.equal(response.json().total, 1, 'API returns 1 filtered');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered');
    t.match(response.json().items[0], rob, 'Filtered');

    // invalid where
    response = await fastify.inject({
        method: 'GET',
        url: '/api/wheretests',
        query: {
            where: JSON.stringify({
                name: { $nonvalid: false }
            })
        }
    });
    t.equal(response.statusCode, 500, 'API returns 500 status code');
    t.equal(response.json().message, 'Invalid where method: $nonvalid');

    // $regex
    response = await fastify.inject({
        method: 'GET',
        url: '/api/wheretests',
        query: {
            where: JSON.stringify({
                name: { $regex: '^A' }
            })
        }
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.equal(response.json().total, 1, 'API returns 1 filtered');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered');
    t.match(response.json().items[0], alice, 'Filtered');

    response = await fastify.inject({
        method: 'GET',
        url: '/api/wheretests',
        query: {
            where: JSON.stringify({
                name: { $regex: '^a' }
            })
        }
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.equal(response.json().total, 0, 'API returns 0 filtered');

    response = await fastify.inject({
        method: 'GET',
        url: '/api/wheretests',
        query: {
            where: JSON.stringify({
                name: { $regex: '^a', $options: 'i' }
            })
        }
    });

    t.equal(response.statusCode, 200, 'API returns 200 status code');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'API returns correct content type'
    );

    t.equal(response.json().total, 1, 'API returns 1 filtered');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered');
    t.match(response.json().items[0], alice, 'Filtered');
});

test('teardown', async () => {
    await fastify.close();
    await mongooseConnection.close();
});
