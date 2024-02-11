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
    const schema = mongoose.Schema({
        name: String,
        appleCount: Number,
        bananaCount: Number
    });

    bw.conn.model('WhereTest', schema);
    t.ok(bw.conn.models.WhereTest);
});

test('clean up test collections', async () => {
    await bw.conn.models.WhereTest.deleteMany({}).exec();
});

test('initialization of API server', async t => {
    await bw.createServer({
        models: bw.conn.models
    });

    t.equal(
        bw.fastify.mongooseAPI.apiRouters.WhereTest.collectionName,
        'wheretests',
        'Collection name used in API path'
    );
});

const bob = { name: 'Bob', appleCount: 1, bananaCount: 2 };
const rob = { name: 'Rob', appleCount: 2, bananaCount: 3 };
const alice = { name: 'Alice', appleCount: 50, bananaCount: 90 };

test('POST item test', async t => {
    let response = null;

    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/wheretests',
        payload: bob
    });

    t.match(response.json(), bob, 'POST api ok');

    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/wheretests',
        payload: rob
    });

    t.match(response.json(), rob, 'POST api ok');

    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/wheretests',
        payload: alice
    });

    t.match(response.json(), alice, 'POST api ok');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/wheretests'
    });

    t.equal(response.json().total, 3, 'There re 3 banana holders');
});

test('GET collection complex where', async t => {
    let response = null;

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/wheretests',
        query: { where: '{"bananaCount": 2}' }
    });

    t.equal(response.json().total, 1, 'API returns 1 filtered');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered');
    t.match(response.json().items[0], bob, 'Filtered');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/wheretests',
        query: { where: JSON.stringify({ appleCount: { $gt: 10 } }) }
    });

    t.equal(response.json().total, 1, 'API returns 1 filtered');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered');
    t.match(response.json().items[0], alice, 'Filtered');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/wheretests',
        query: {
            where: JSON.stringify({
                $and: [{ appleCount: { $gt: 1 } }, { bananaCount: { $lt: 5 } }]
            })
        }
    });

    t.equal(response.json().total, 1, 'API returns 1 filtered');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered');
    t.match(response.json().items[0], rob, 'Filtered');

    // invalid where
    response = await bw.inject(
        t,
        {
            method: 'GET',
            url: '/api/wheretests',
            query: {
                where: JSON.stringify({
                    name: { $nonvalid: false }
                })
            }
        },
        500
    );

    // $regex
    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/wheretests',
        query: {
            where: JSON.stringify({
                name: { $regex: '^A' }
            })
        }
    });

    t.equal(response.json().total, 1, 'API returns 1 filtered');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered');
    t.match(response.json().items[0], alice, 'Filtered');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/wheretests',
        query: {
            where: JSON.stringify({
                name: { $regex: '^a' }
            })
        }
    });

    t.equal(response.json().total, 0, 'API returns 0 filtered');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/wheretests',
        query: {
            where: JSON.stringify({
                name: { $regex: '^a', $options: 'i' }
            })
        }
    });

    t.equal(response.json().total, 1, 'API returns 1 filtered');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered');
    t.match(response.json().items[0], alice, 'Filtered');
});
