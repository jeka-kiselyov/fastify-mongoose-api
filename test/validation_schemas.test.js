'use strict';

const t = require('tap');
const { test } = t;

const mongoose = require('mongoose');
const BackwardWrapper = require('./BackwardWrapper.js');

const bw = new BackwardWrapper(t);

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
                type: 'object',
                properties: {
                    total: { type: 'integer' },
                    items: {
                        type: 'array',
                        items: { $ref: `${collection}#` }
                    }
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

test('mongoose db initialization', async () => {
    await bw.createConnection();
});

test('schema initialization', async t => {
    const authorSchema = mongoose.Schema(schema_base.schema);
    bw.conn.model('Author', authorSchema);
    t.ok(bw.conn.models.Author);
});

// base, empty, with_ref should have old working mode

//[schema_base, schema_empty, schema_with_ref].forEach(schema => {
[schema_base, schema_empty, schema_with_ref].forEach(schema => {
    test('clean up test collections', async () => {
        await bw.conn.models.Author.deleteMany({}).exec();
    });

    test('initialization of API server', async () => {
        await bw.createServer({
            models: bw.conn.models,
            setDefaults: true,
            schemas: [schema]
        });
    });

    test('POST item test', async t => {
        let response = null;
        response = await bw.inject(t, {
            method: 'POST',
            url: '/api/authors',
            payload: { firstName: 'Hutin', lastName: 'Puylo' }
        });

        t.match(
            response.json(),
            { firstName: 'Hutin', lastName: 'Puylo' },
            'POST api ok'
        );

        response = await bw.inject(t, {
            method: 'GET',
            url: '/api/authors'
        });

        t.match(
            response.json().items[0],
            { firstName: 'Hutin', lastName: 'Puylo' },
            'Listed same'
        );
        t.equal(response.json().total, 1, 'There are author now');
    });

    test('NO validation so, also a field is valid', async t => {
        const response = await bw.inject(t, {
            method: 'POST',
            url: '/api/authors',
            payload: {
                firstName: 'Hutin'
            }
        });

        t.match(response.json(), { firstName: 'Hutin' }, 'POST api ok');
    });

    test('POST valid birthday', async t => {
        let response = null;
        response = await bw.inject(t, {
            method: 'POST',
            url: '/api/authors',
            payload: {
                firstName: 'Hutin',
                lastName: 'Puylo',
                birthday: '1969-07-06'
            }
        });

        t.match(
            response.json(),
            {
                firstName: 'Hutin',
                lastName: 'Puylo',
                birthday: '1969-07-06'
            },
            'POST api ok'
        );

        response = await bw.inject(t, {
            method: 'GET',
            url: '/api/authors'
        });

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
        const response = await bw.inject(
            t,
            {
                method: 'POST',
                url: '/api/authors',
                payload: {
                    firstName: 'Hutin',
                    lastName: 'Puylo',
                    birthday: '1969-30-06'
                }
            },
            500
        );

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
        await bw.fastify.close();
    });
});

test('clean up test collections', async () => {
    await bw.conn.models.Author.deleteMany({}).exec();
});

test('initialization of API server with validation', async () => {
    await bw.createServer({
        models: bw.conn.models,
        setDefaults: true,
        schemas: [schema_full]
    });
});

test('Check required validation', async t => {
    const response = await bw.inject(
        t,
        {
            method: 'POST',
            url: '/api/authors',
            payload: { firstName: 'Hutin' }
        },
        400
    );

    t.match(
        response.json().message,
        "body must have required property 'lastName'",
        'POST refused'
    );
});

test('POST valid birthday', async t => {
    let response = null;
    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/authors',
        payload: {
            firstName: 'Hutin',
            lastName: 'Puylo',
            birthday: '1969-07-06'
        }
    });

    t.match(
        response.json(),
        { firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-07-06' },
        'POST api ok'
    );

    response = await bw.inject(t, {
        method: 'GET',
        url: '/api/authors'
    });

    t.match(
        response.json().items[0],
        { firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-07-06' },
        'Listed same'
    );
    t.equal(response.json().total, 1, 'There are author now');
});

test('POST invalid birthday', async t => {
    let response = null;
    response = await bw.inject(
        t,
        {
            method: 'POST',
            url: '/api/authors',
            payload: {
                firstName: 'Hutin',
                lastName: 'Puylo',
                birthday: '1969-30-06'
            }
        },
        400
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
