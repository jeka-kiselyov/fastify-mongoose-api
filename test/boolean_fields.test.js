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
        aGoodMan: Boolean
    });

    bw.conn.model('BooleanTest', schema);
    t.ok(bw.conn.models.BooleanTest);
});

test('clean up test collections', async () => {
    await bw.conn.models.BooleanTest.deleteMany({}).exec();
});

test('initialization of API server', async t => {
    await bw.createServer({
        models: bw.conn.models
    });

    t.equal(
        bw.fastify.mongooseAPI.apiRouters.BooleanTest.collectionName,
        'booleantests',
        'Collection name used in API path'
    );
});

test('POST item test', async t => {
    let response = null;
    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/booleantests',
        payload: { name: 'Good', aGoodMan: true }
    });

    t.match(response.json(), { name: 'Good', aGoodMan: true }, 'POST api ok');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/booleantests'
    });

    t.equal(response.json().total, 1, 'There is one good man');
});

test('POST item false test', async t => {
    let response = null;

    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/booleantests',
        body: { name: 'Bad', aGoodMan: false }
    });

    t.match(response.json(), { name: 'Bad', aGoodMan: false }, 'POST api ok');

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/booleantests'
    });

    t.equal(response.json().total, 2, 'There are 2 men');
});

test('Update to false test', async t => {
    let response = null;

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/booleantests'
    });

    t.equal(response.json().total, 2, 'There re 2 men');

    let goodId = null;
    let foundGood = false;
    for (let item of response.json().items) {
        if (item.aGoodMan === true) {
            goodId = item._id;
            foundGood = true;
        }
    }

    t.ok(foundGood);

    response = await bw.inject(t, {
        method: 'PUT',
        url: '/api/booleantests/' + goodId,
        payload: { aGoodMan: false }
    });

    t.match(response.json(), { name: 'Good', aGoodMan: false }, 'PUT api ok');
});

test('GET collection filtering', async t => {
    const response = await bw.inject(t, {
        method: 'GET',
        url: '/api/booleantests',
        query: { filter: 'aGoodMan=0' }
    });

    t.equal(response.json().total, 2, 'API returns 2 filtered men');
    t.equal(response.json().items.length, 2, 'API returns 2 filtered men');
});

test('And back to true', async t => {
    let response = null;

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/booleantests'
    });

    t.equal(response.json().total, 2, 'There re 2 men');

    let goodId = null;
    let foundGood = false;
    for (let item of response.json().items) {
        if (item.name === 'Good') {
            goodId = item._id;
            foundGood = true;
        }
    }

    t.ok(foundGood);

    response = await bw.inject(t, {
        method: 'PUT',
        url: '/api/booleantests/' + goodId,
        payload: { aGoodMan: true }
    });

    t.match(response.json(), { name: 'Good', aGoodMan: true }, 'PUT api ok');
});

test('GET collection filtering', async t => {
    let response = null;

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/booleantests',
        query: { filter: 'aGoodMan=0' }
    });

    t.equal(response.json().total, 1, 'API returns 1 filtered man');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered man');
    t.match(
        response.json().items[0],
        { name: 'Bad', aGoodMan: false },
        'Filtered author'
    );
});

test('GET collection filtering', async t => {
    const response = await bw.inject(t, {
        method: 'GET',
        url: '/api/booleantests',
        query: { filter: 'aGoodMan=1' }
    });

    t.equal(response.json().total, 1, 'API returns 1 filtered man');
    t.equal(response.json().items.length, 1, 'API returns 1 filtered man');
    t.match(
        response.json().items[0],
        { name: 'Good', aGoodMan: true },
        'Filtered author'
    );
});
