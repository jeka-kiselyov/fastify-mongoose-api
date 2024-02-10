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
let response = null;

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
        bananaCount: Number,
        fieldAvailableIfYouAskGood: { type: Number, default: 999 }
    });

    schema.methods.apiValues = function (request) {
        if (!request.headers['givememoredataplease']) {
            return {
                name: this.name,
                appleCount: this.appleCount,
                bananaCount: this.bananaCount
            };
        }

        // or return this.toObject();
        //

        return {
            name: this.name,
            appleCount: this.appleCount,
            bananaCount: this.bananaCount,
            fieldAvailableIfYouAskGood: this.fieldAvailableIfYouAskGood
        };
    };

    schema.methods.apiPut = async function () {
        // disable the Put completely
        throw new Error('PUT is disabled for this route');
    };

    schema.statics.apiPost = async function (data, request) {
        // lets POST only with specific header
        // possible option is to check user rights here
        // if (!request.user.hasRightToPost()) {
        // 	throw new Error('Lol, you cant');
        // }
        if (!request.headers['letmepostplease']) {
            throw new Error('POST is disabled for you!');
        }

        let doc = new mongooseConnection.models.WhereTest();

        mongooseConnection.models.WhereTest.schema.eachPath(pathname => {
            if (data[pathname] !== undefined) {
                doc[pathname] = data[pathname];
            }
        });

        await doc.save();
        return doc;
    };

    schema.methods.apiDelete = async function () {
        // disable the Put completely
        throw new Error('DELETE is disabled for this route');
    };

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

test('Disabled POST item test', async t => {
    let response = null;
    response = await fastify.inject({
        method: 'POST',
        url: '/api/wheretests',
        payload: { name: 'Bob', appleCount: 1, bananaCount: 2 }
    });

    t.equal(
        response.statusCode,
        500,
        "doesn't let you post without extra header"
    );

    response = await fastify.inject({
        method: 'POST',
        url: '/api/wheretests',
        headers: { letmepostplease: 'pleaaaaase' },
        payload: { name: 'Bob', appleCount: 1, bananaCount: 2 }
    });

    t.equal(response.statusCode, 200, 'POST with header ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Content-Type header is correct'
    );

    t.match(
        response.json(),
        { name: 'Bob', appleCount: 1, bananaCount: 2 },
        'POST with header ok'
    );
    t.has(
        response.json(),
        { fieldAvailableIfYouAskGood: undefined },
        'does not have fieldAvailableIfYouAskGood field by default'
    );
});

test('Has Extra field in response by apiValues', async t => {
    response = await fastify.inject({
        method: 'POST',
        url: '/api/wheretests',
        headers: {
            letmepostplease: 'pleaaaaase',
            givememoredataplease: 'pleaaaaase'
        },
        payload: { name: 'Bob', appleCount: 1, bananaCount: 2 }
    });

    t.equal(response.statusCode, 200, 'POST with header ok');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Content-Type header is correct'
    );

    t.match(
        response.json(),
        { name: 'Bob', appleCount: 1, bananaCount: 2 },
        'POST with header ok'
    );

    t.ok(
        response.json().fieldAvailableIfYouAskGood !== undefined,
        'fieldAvailableIfYouAskGood is present'
    );
});

test('Disabled PUT test', async t => {
    let itemFromDb = await mongooseConnection.models.WhereTest.findOne({});

    let response = null;
    response = await fastify.inject({
        method: 'PUT',
        url: '/api/wheretests/' + itemFromDb.id,
        payload: { name: 'Bob22', appleCount: 21, bananaCount: 22 }
    });

    t.equal(response.statusCode, 500, "doesn't let you PUT ever");
});

test('Disabled DELETE test', async t => {
    let itemFromDb = await mongooseConnection.models.WhereTest.findOne({});

    let response = null;
    response = await fastify.inject({
        method: 'DELETE',
        url: '/api/wheretests/' + itemFromDb.id
    });

    t.equal(response.statusCode, 500, "doesn't let you DELETE ever");
});

test('teardown', async () => {
    await fastify.close();
    await mongooseConnection.close();
});
