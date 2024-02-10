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

test('mongoose db initialization', async t => {
    t.plan(2);

    mongooseConnection = await BackwardWrapper.createConnection(MONGODB_URL);
    t.ok(mongooseConnection);
    t.equal(mongooseConnection.readyState, 1, 'Ready state is connected(==1)'); /// connected
});

test('schema initialization', async t => {
    const schema = mongoose.Schema({
        name: String
    });
    schema.methods.apiValues = function () {
        return { name: this.name };
    };
    schema.methods.apiPut = function () {
        return { name: this.name };
    };
    schema.methods.apiDelete = function () {
        return { name: this.name };
    };

    schema.statics.apiPost = function () {
        return { name: this.name };
    };
    schema.statics.apiSubRoutes = function () {
        return [];
    };

    mongooseConnection.model('Test', schema);
    t.ok(mongooseConnection.models.Test);
});

test('does not let initialize plugin class directly', async t => {
    t.throws(() => {
        new fastifyMongooseAPI();
    });
    t.throws(() => {
        new fastifyMongooseAPI({ fastify: 1 });
    });
    t.throws(() => {
        new fastifyMongooseAPI({ models: 3 });
    });
});

test('initialization of API server', async t => {
    ///// setting up the server
    fastify = Fastify();

    fastify.register(fastifyMongooseAPI, {
        models: mongooseConnection.models,
        setDefaults: false
    });

    await fastify.ready();

    t.ok(fastify.mongooseAPI, 'mongooseAPI decorator is available');
});

test('teardown', async () => {
    await fastify.close();
    await mongooseConnection.close();
});
