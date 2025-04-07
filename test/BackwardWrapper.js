const mongoose = require('mongoose');

class BackwardWrapper {
    constructor(t) {
        this.MONGODB_URL =
            process.env.DATABASE_URI ||
            'mongodb://127.0.0.1/fastifymongooseapitest';
        this.t = t;
    }

    async createServer(pluginConfig = {}) {
        const Fastify = require('fastify');
        const fastifyMongooseAPI = require('../fastify-mongoose-api.js');

        const fastify = Fastify();
        fastify.register(fastifyMongooseAPI, pluginConfig);
        await fastify.ready();

        this.t.ok(fastify.mongooseAPI, 'mongooseAPI decorator is available');

        this.t.teardown(async () => {
            await fastify.close();
        });

        this.fastify = fastify;
        return fastify;
    }

    async createConnection() {
        this.conn = await mongoose
            .createConnection(this.MONGODB_URL)
            .asPromise();

        this.t.ok(this.conn);
        this.t.equal(this.conn.readyState, 1, 'Ready state is connected(==1)'); /// connected

        this.t.teardown(async () => {
            await this.conn.close();
        });
    }

    async populateDoc(populated) {
        if (populated.execPopulate) {
            return await populated.execPopulate();
        } else {
            return await populated;
        }
    }

    async inject(t, injectOptions, expectedStatusCode = 200, debug = false) {
        const response = await this.fastify.inject(injectOptions);

        if (debug) {
            console.error(response);
        }

        t.equal(
            response.statusCode,
            expectedStatusCode,
            `Status code is ${expectedStatusCode}`
        );
        t.equal(
            response.headers['content-type'],
            'application/json; charset=utf-8',
            'Content-Type is correct'
        );
        return response;
    }
}

module.exports = BackwardWrapper;
