'use strict';

const fastifyMongooseAPI = require('../fastify-mongoose-api.js');

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

    bw.conn.model('Test', schema);
    t.ok(bw.conn.models.Test);
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

test('initialization of API server', async () => {
    await bw.createServer({
        models: bw.conn.models,
        setDefaults: false
    });
});
