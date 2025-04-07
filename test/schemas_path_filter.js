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
        path.join(tmpPath, 'authors.schema.js'),
        'module.exports=' + JSON.stringify(schema_authors)
    );
    // books.schema.js.disabled
    fs.mkdirSync(path.join(tmpPath, 'subdir'));
    fs.writeFileSync(
        path.join(tmpPath, 'books.schema.js.disabled'),
        'module.exports=' + JSON.stringify(schema_books)
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

test('initialization of default API server', async () => {
    await bw.createServer({
        models: bw.conn.models,
        setDefaults: true,
        schemaDirPath: tmpPath
    });
});

test('author schema exists', async t => {
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

test('book schema does not exist (POST without ISBN)', async t => {
    await bw.inject(t, {
        method: 'POST',
        url: '/api/books',
        payload: { title: 'Critique of Practical Reason' }
    });
});

test('Shutdown API server', async () => {
    await bw.fastify.close();
});

test('reload API server changing default filter to include disabled schema', async () => {
    await bw.createServer({
        models: bw.conn.models,
        setDefaults: true,
        schemaDirPath: tmpPath,
        schemaPathFilter: (filePath, fileName) => {
            // Filter to include .schema.js and .schema.js.disabled files
            return (
                fileName.endsWith('.js') || fileName.endsWith('.js.disabled')
            );
        }
    });
});

test('author schema exists too', async t => {
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

test('book schema exists (POST without ISBN is not valid)', async t => {
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

test('teardown', async () => {
    fs.unlinkSync(path.join(tmpPath, 'authors.schema.js'));
    fs.unlinkSync(path.join(tmpPath, 'books.schema.js.disabled'));
    fs.rmdirSync(path.join(tmpPath, 'subdir'));
    fs.rmdirSync(tmpPath);
});
