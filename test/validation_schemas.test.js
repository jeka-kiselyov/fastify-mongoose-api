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

let collection = 'authors';

let schema_base = {
    name: collection,
    schema: {
        firstName: String,
        lastName: String,
        birthday: Date
    }
};

let schema_empty = {
    ...schema_base,
    routeGet: {},
    routePost: {},
    routeList: {},
    routePut: {},
    routePatch: {},
    routeDelete: {}
};

let schema_with_ref = {
    ...schema_base,
    ref: [
        {
            $id: collection,
            title: collection + ' - Model',
            properties: {
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                birthday: {
                    type: 'string',
                    format: 'date'
                }
            },
            required: ['firstName', 'lastName']
        }
    ]
};

let schema_full = {
    ...schema_with_ref,
    routeGet: {
        response: {
            200: {
                $ref: `${collection}#`
            }
        }
    },
    routePost: {
        body: {
            $ref: `${collection}#`
        },
        response: {
            200: {
                $ref: `${collection}#`
            }
        }
    },

    routeList: {
        response: {
            200: {
                total: { type: 'integer', example: '1' },
                items: {
                    type: 'array',
                    items: { $ref: `${collection}#` }
                }
            }
        }
    },

    routePut: {
        body: {
            $ref: `${collection}#`
        },
        response: {
            200: {
                $ref: `${collection}#`
            }
        }
    },

    routePatch: {
        body: {
            $ref: `${collection}#`
        },
        response: {
            200: {
                $ref: `${collection}#`
            }
        }
    },

    routeDelete: {}
};

test('mongoose db initialization', async t => {
    mongooseConnection = await BackwardWrapper.createConnection(MONGODB_URL);
    t.ok(mongooseConnection);
    t.equal(mongooseConnection.readyState, 1, 'Ready state is connected(==1)'); /// connected
});

test('schema initialization', async t => {
    const authorSchema = mongoose.Schema(schema_base.schema);
    mongooseConnection.model('Author', authorSchema);
    t.ok(mongooseConnection.models.Author);
});

// base, empty, with_ref should have old working mode

//[schema_base, schema_empty, schema_with_ref].forEach(schema => {
[schema_base, schema_empty, schema_with_ref].forEach(schema => {
    let fastify;

    test('clean up test collections', async () => {
        await mongooseConnection.models.Author.deleteMany({}).exec();
    });

    test('initialization of API server', async () => {
        ///// setting up the server
        fastify = Fastify();

        fastify.register(fastifyMongooseAPI, {
            models: mongooseConnection.models,
            setDefaults: true,
            schemas: [schema]
        });

        await fastify.ready();
    });

    test('POST item test', async t => {
        let response = null;
        response = await fastify.inject({
            method: 'POST',
            url: '/api/authors',
            payload: { firstName: 'Hutin', lastName: 'Puylo' }
        });

        t.equal(response.statusCode, 200, 'POST api ok');
        t.equal(
            response.headers['content-type'],
            'application/json; charset=utf-8'
        );

        t.match(
            response.json(),
            { firstName: 'Hutin', lastName: 'Puylo' },
            'POST api ok'
        );

        response = await fastify.inject({
            method: 'GET',
            url: '/api/authors'
        });

        t.equal(response.statusCode, 200, 'GET api ok');
        t.equal(
            response.headers['content-type'],
            'application/json; charset=utf-8'
        );

        t.match(
            response.json().items[0],
            { firstName: 'Hutin', lastName: 'Puylo' },
            'Listed same'
        );
        t.equal(response.json().total, 1, 'There are author now');
    });

    test('NO validation so, also a field is valid', async t => {
        let response = null;
        response = await fastify.inject({
            method: 'POST',
            url: '/api/authors',
            payload: {
                firstName: 'Hutin'
            }
        });

        t.equal(response.statusCode, 200, 'POST api ok');
        t.equal(
            response.headers['content-type'],
            'application/json; charset=utf-8'
        );

        t.match(response.json(), { firstName: 'Hutin' }, 'POST api ok');
    });

    test('POST valid birthday', async t => {
        let response = null;
        response = await fastify.inject({
            method: 'POST',
            url: '/api/authors',
            payload: {
                firstName: 'Hutin',
                lastName: 'Puylo',
                birthday: '1969-07-06'
            }
        });

        t.equal(response.statusCode, 200, 'POST api ok');
        t.equal(
            response.headers['content-type'],
            'application/json; charset=utf-8'
        );
        t.match(
            response.json(),
            {
                firstName: 'Hutin',
                lastName: 'Puylo',
                birthday: '1969-07-06'
            },
            'POST api ok'
        );

        response = await fastify.inject({
            method: 'GET',
            url: '/api/authors'
        });

        t.equal(response.statusCode, 200, 'GET api ok');
        t.equal(
            response.headers['content-type'],
            'application/json; charset=utf-8'
        );

        t.match(
            response.json().items[2],
            {
                firstName: 'Hutin',
                lastName: 'Puylo',
                birthday: '1969-07-06'
            },
            'Listed same'
        );
        t.equal(response.json().total, 3, 'There are author now');
    });

    test('POST invalid birthday', async t => {
        let response = null;
        response = await fastify.inject({
            method: 'POST',
            url: '/api/authors',
            payload: {
                firstName: 'Hutin',
                lastName: 'Puylo',
                birthday: '1969-30-06'
            }
        });

        t.equal(response.statusCode, 500, 'Internal server error');

        t.type(response.json().message, 'string');
        // it may be a simple:
        // "Cast to date failed"
        // or something like:
        // "Author validation failed: birthday: Cast to Date failed for value \"1969-30-06\" at path \"birthday\""
        // depending on Fastify ( ajv ? ) version.
        // So let's just check if there's "Cast to date failed" in the message
        t.match(
            response.json().message,
            /[\s\S]*Cast to [Dd]ate failed[\s\S]*/
        );
    });

    test('Shutdown API server', async () => {
        await fastify.close();
    });
});

test('clean up test collections', async () => {
    await mongooseConnection.models.Author.deleteMany({}).exec();
});

test('initialization of API server with validation', async () => {
    ///// setting up the server
    fastify = Fastify();

    fastify.register(fastifyMongooseAPI, {
        models: mongooseConnection.models,
        setDefaults: true,
        schemas: [schema_full]
    });

    await fastify.ready();
});

test('Check required validation', async t => {
    let response = null;
    response = await fastify.inject({
        method: 'POST',
        url: '/api/authors',
        payload: { firstName: 'Hutin' }
    });

    t.equal(
        response.statusCode,
        400,
        'POST api with missing required property should return 400'
    );

    t.match(
        response.json().message,
        "body must have required property 'lastName'",
        'POST refused'
    );
});

test('POST valid birthday', async t => {
    let response = null;
    response = await fastify.inject({
        method: 'POST',
        url: '/api/authors',
        payload: {
            firstName: 'Hutin',
            lastName: 'Puylo',
            birthday: '1969-07-06'
        }
    });

    t.equal(response.statusCode, 200, 'POST api should return 200');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Content-Type should be application/json; charset=utf-8'
    );
    t.match(
        response.json(),
        { firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-07-06' },
        'POST api ok'
    );

    response = await fastify.inject({
        method: 'GET',
        url: '/api/authors'
    });

    t.equal(response.statusCode, 200, 'GET api should return 200');
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Content-Type should be application/json; charset=utf-8'
    );

    t.match(
        response.json().items[0],
        { firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-07-06' },
        'Listed same'
    );
    t.equal(response.json().total, 1, 'There are author now');
});

test('POST invalid birthday', async t => {
    let response = null;
    response = await fastify.inject({
        method: 'POST',
        url: '/api/authors',
        payload: {
            firstName: 'Hutin',
            lastName: 'Puylo',
            birthday: '1969-30-06'
        }
    });

    t.equal(
        response.statusCode,
        400,
        'POST api with invalid birthday should return 400'
    );
    t.equal(
        response.headers['content-type'],
        'application/json; charset=utf-8',
        'Content-Type should be application/json; charset=utf-8'
    );
    t.match(
        response.json().message,
        'body/birthday must match format "date"',
        'POST api ok'
    );
});

test('teardown', async () => {
    await fastify.close();
    await mongooseConnection.close();
});
