'use strict';

const t = require('tap');
const { test } = t;

const fs = require('fs');
const os = require('os');
const path = require('path');

const mongoose = require('mongoose');
const BackwardWrapper = require('./BackwardWrapper.js');

const bw = new BackwardWrapper(t);

const schema_authors = {
    name: 'authors',
    schema: {
        firstName: 'String',
        lastName: 'String',
        birthday: 'Date'
    },
    ref: [
        {
            $id: 'authors',
            title: 'Authors - Model',
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
    ],
    routeGet: {
        response: {
            200: {
                $ref: 'authors#'
            }
        }
    },
    routePost: {
        body: {
            $ref: 'authors#'
        },
        response: {
            200: {
                $ref: 'authors#'
            }
        }
    }
};

const schema_books = {
    name: 'books',
    schema: {
        title: 'String',
        isbn: 'String',
        created: {
            type: 'Date',
            default: Date.now
        }
    },
    ref: [
        {
            $id: 'books',
            title: 'Books - Model',
            properties: {
                title: { type: 'string' },
                isbn: { type: 'string' },
                created: {
                    type: 'string',
                    format: 'date'
                }
            },
            required: ['title', 'isbn']
        }
    ],
    routeGet: {
        response: {
            200: {
                $ref: 'books#'
            }
        }
    },
    routePost: {
        body: {
            $ref: 'books#'
        },
        response: {
            200: {
                $ref: 'books#'
            }
        }
    }
};

const createSchemasInTmpPath = () => {
    const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mfas-'));
    // authors.schema.js
    fs.writeFileSync(
        path.join(tmpPath, 'authors.schema.mjs'),
        'export default ' + JSON.stringify(schema_authors)
    );
    // subdir/books.schema.js
    fs.mkdirSync(path.join(tmpPath, 'subdir'));
    fs.writeFileSync(
        path.join(tmpPath, 'subdir', 'books.schema.mjs'),
        'export default' + JSON.stringify(schema_books)
    );
    return tmpPath;
};

const tmpPath = createSchemasInTmpPath();

test('valid schemaDir', async t => {
    t.not(tmpPath, undefined, 'schemaDir is valid');
});

test('mongoose db initialization', async () => {
    await bw.createConnection();
});

test('schema initialization', async t => {
    const authorSchema = mongoose.Schema(schema_authors.schema);
    bw.conn.model('Author', authorSchema);

    const bookSchema = mongoose.Schema(schema_books.schema);
    bw.conn.model('Book', bookSchema);

    t.ok(bw.conn.models.Author);
    t.ok(bw.conn.models.Book);
});

test('clean up test collections', async () => {
    await bw.conn.models.Author.deleteMany({}).exec();
    await bw.conn.models.Book.deleteMany({}).exec();
});

test('initialization of API server', async () => {
    await bw.createServer({
        models: bw.conn.models,
        setDefaults: true,
        schemaDirPath: tmpPath,
        schemaPathFilter: (filePath, fileName) => {
            // Filter to include .mjs
            console.log(`filePath: ${filePath}, fileName: ${fileName}`);
            return fileName.endsWith('.mjs');
        }
    });
});

test('POST author item test', async t => {
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

test('POST only firstName', async t => {
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
        'POST failed if required parameters not set'
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
        response.json().items[1],
        { firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-07-06' },
        'Listed same'
    );
    t.equal(response.json().total, 2, 'There are author now');
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
        400
    );

    t.match(
        response.json().message,
        'body/birthday must match format "date"',
        'POST api ok'
    );
});

test('POST book item test', async t => {
    const response = await bw.inject(t, {
        method: 'POST',
        url: '/api/books',
        payload: { title: 'Critique of Practical Reason', isbn: '1519394632' }
    });

    t.match(
        response.json(),
        { title: 'Critique of Practical Reason', isbn: '1519394632' },
        'POST api ok'
    );
});

test('POST book without isbn', async t => {
    const response = await bw.inject(
        t,
        {
            method: 'POST',
            url: '/api/books',
            payload: { title: 'Critique of Practical Reason' }
        },
        400
    );

    t.match(
        response.json().message,
        "body must have required property 'isbn'",
        'POST failed if required parameters not set'
    );
});

test('Shutdown API server', async () => {
    await bw.fastify.close();
});

// now birthday is required too
schema_authors.ref[0].required = ['firstName', 'lastName', 'birthday'];

test('reload API server with schemas', async () => {
    await bw.createServer({
        models: bw.conn.models,
        setDefaults: true,
        schemas: [schema_authors], // this replaces one loaded in dirPath
        schemaDirPath: tmpPath
    });
});

test('POST without birthday', async t => {
    const response = await bw.inject(
        t,
        {
            method: 'POST',
            url: '/api/authors',
            payload: { firstName: 'Hutin', lastName: 'Puylo' }
        },
        400
    );

    t.match(
        response.json().message,
        "body must have required property 'birthday'",
        'POST failed if required parameters not set'
    );
});

test('POST with birthday', async t => {
    const response = await bw.inject(t, {
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
});

test('teardown', async () => {
    fs.unlinkSync(path.join(tmpPath, 'authors.schema.mjs'));
    fs.unlinkSync(path.join(tmpPath, 'subdir', 'books.schema.mjs'));
    fs.rmdirSync(path.join(tmpPath, 'subdir'));
    fs.rmdirSync(tmpPath);
});
