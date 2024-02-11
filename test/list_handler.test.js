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

    schema.statics.onListQuery = async function (query, request) {
        let evenBananas = request.query.even ? request.query.even : null;
        if (evenBananas) {
            query = query.and({ bananaCount: { $mod: [2, 0] } });
        }

        // DO NOT RETURN THE QUERY
    };

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

test('POST item test', async t => {
    let response = null;
    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/wheretests',
        payload: { name: 'Bob', appleCount: 1, bananaCount: 2 }
    });

    t.match(
        JSON.parse(response.payload),
        { name: 'Bob', appleCount: 1, bananaCount: 2 },
        'POST api ok'
    );

    t.match(
        response.json(),
        { name: 'Bob', appleCount: 1, bananaCount: 2 },
        'POST api ok'
    );

    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/wheretests',
        payload: { name: 'Rob', appleCount: 2, bananaCount: 3 }
    });

    t.match(
        response.json(),
        { name: 'Rob', appleCount: 2, bananaCount: 3 },
        'POST api ok'
    );

    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/wheretests',
        payload: { name: 'Alice', appleCount: 50, bananaCount: 90 }
    });

    t.match(
        response.json(),
        { name: 'Alice', appleCount: 50, bananaCount: 90 },
        'POST api ok'
    );

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/wheretests'
    });

    t.equal(response.json().total, 3, 'There re 3 banana holders');
});

test('GET collection onListQuery', async t => {
    let response = null;

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/wheretests'
    });

    t.equal(response.json().total, 3, 'API returns total 3 items');
    t.equal(response.json().items.length, 3, 'API returns total 3 items');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/wheretests',
        query: { even: true } // URL GET parameters
    });

    t.equal(response.json().total, 2, 'API returns 2 filtered');
    t.equal(response.json().items.length, 2, 'API returns 2 filtered'); /// banana == 2 and banana == 90
});
