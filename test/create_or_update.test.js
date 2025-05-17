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
    const productSchema = mongoose.Schema(
        {
            _id: { type: String, required: true },
            price: { type: Number, required: true }
        },
        {
            timestamps: true
        }
    );

    bw.conn.model('Product', productSchema);
    // bw.conn.Product.collection.drop();

    t.ok(bw.conn.models.Product);
});

test('clean up test collections', async () => {
    await bw.conn.models.Product.deleteMany({}).exec();
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
        1,
        'There are 1 APIRoutes'
    );

    t.equal(
        bw.fastify.mongooseAPI.apiRouters.Product.collectionName,
        'products',
        'Collection name used in API path'
    );

    t.equal(
        bw.fastify.mongooseAPI.apiRouters.Product.path,
        '/api/products',
        'API path is composed with prefix + collectionName'
    );
});
test('POST item test', async t => {
    let response = null;
    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/products',
        payload: {
            _id: 'item 1',
            price: 10
        }
    });

    t.match(response.json(), { _id: 'item 1', price: 10 }, 'POST api ok');

    response = await bw.inject(
        t,
        {
            method: 'POST',
            url: '/api/products',
            payload: {
                _id: 'item 1',
                price: 20
            }
        },
        500
    );
    t.match(
        response.json().message,
        /duplicate key error/,
        'POST api conflict ok if CoU not set'
    );

    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/products',
        payload: {
            _id: 'item 1',
            price: 20
        },
        headers: { 'x-http-method': 'cou' }
    });
    t.match(
        response.json(),
        { _id: 'item 1', price: 20 },
        'POST api ok with CoU via header'
    );

    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/products',
        payload: {
            _id: 'item 1',
            price: 30
        },
        headers: { 'X-HTTP-Method': 'CoU' }
    });
    t.match(
        response.json(),
        { _id: 'item 1', price: 30 },
        'post api ok with cou via header case insensitive'
    );

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/products/item 1'
    });
    t.match(
        response.json(),
        { _id: 'item 1', price: 30 },
        'Record correctly updated'
    );

    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/products',
        payload: {
            _id: 'item 2',
            price: 69
        },
        headers: { 'X-HTTP-Method': 'CoU' }
    });
    console.log(response.json());
    t.match(
        response.json(),
        { _id: 'item 2', price: 69 },
        'new record standard saved also if CoU is set'
    );

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/products'
    });
    t.equal(response.json().total, 2, 'API returns 2 products');
    t.equal(response.json().items.length, 2, 'API returns 2 products');
    t.match(
        response.json().items[0],
        { _id: 'item 1', price: 30 },
        'Listed same'
    );
    t.match(
        response.json().items[1],
        { _id: 'item 2', price: 69 },
        'Listed same'
    );
});
