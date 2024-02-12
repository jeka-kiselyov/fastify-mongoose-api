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
    const authorSchema = mongoose.Schema({
        firstName: String,
        lastName: String,
        biography: { description: String, born: Number },
        created: {
            type: Date,
            default: Date.now
        }
    });

    bw.conn.model('Author', authorSchema);

    t.ok(bw.conn.models.Author);
});

test('clean up test collections', async () => {
    await bw.conn.models.Author.deleteMany({}).exec();
});

test('initialization of API server', async t => {
    await bw.createServer({
        models: bw.conn.models,
        prefix: '/api/',
        setDefaults: true,
        methods: ['list', 'get', 'post', 'patch', 'put', 'delete', 'options']
    });

    t.equal(
        bw.fastify.mongooseAPI.apiRouters.Author.collectionName,
        'authors',
        'Collection name used in API path'
    );
    t.equal(
        bw.fastify.mongooseAPI.apiRouters.Author.path,
        '/api/authors',
        'API path is composed with prefix + collectionName'
    );
});

test('POST item test', async t => {
    let response = null;
    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/authors',
        payload: {
            firstName: 'Hutin',
            lastName: 'Puylo',
            'biography.description': 'was good',
            'biography.born': '1960'
        }
    });

    t.match(
        JSON.parse(response.payload),
        {
            firstName: 'Hutin',
            lastName: 'Puylo',
            biography: { description: 'was good', born: 1960 }
        },
        'POST api response matches expected'
    );

    t.match(
        response.json(),
        {
            firstName: 'Hutin',
            lastName: 'Puylo',
            biography: { description: 'was good', born: 1960 }
        },
        'POST api ok'
    );

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors'
    });

    t.match(
        response.json().items[0],
        {
            firstName: 'Hutin',
            lastName: 'Puylo',
            biography: { description: 'was good', born: 1960 }
        },
        'Listed same'
    );
    t.equal(response.json().total, 1, 'There are author now');
});

test('PUT item test', async t => {
    let authorFromDb = await bw.conn.models.Author.findOne({
        firstName: 'Hutin'
    });
    // await BackwardWrapper.populateDoc(bookFromDb.populate('author'));

    const response = await bw.inject(t, {
        method: 'PUT',
        url: '/api/authors/' + authorFromDb.id,
        payload: { lastName: 'Chuvachello', 'biography.born': 1961 }
    });

    t.match(
        response.json(),
        {
            firstName: 'Hutin',
            lastName: 'Chuvachello',
            biography: { description: 'was good', born: 1961 }
        },
        'PUT api ok'
    );
});
