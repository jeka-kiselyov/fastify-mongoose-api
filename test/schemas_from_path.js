'use strict'

const fastifyMongooseAPI = require('../fastify-mongoose-api.js');

const t = require('tap');
const { test } = t;
const supertest = require('supertest');

const fs = require('fs');
const os = require('os');
const path = require('path');

const Fastify = require('fastify');
const mongoose = require('mongoose');
const fastifyFormbody = require('fastify-formbody');

const FASTIFY_PORT = 3137;
const MONGODB_URL = process.env.DATABASE_URI || 'mongodb://127.0.0.1/fastifymongooseapitest';

const BackwardWrapper = require('./BackwardWrapper.js');
const { stringify } = require('querystring');

let mongooseConnection = null;
let fastify = null;

const schema_authors = {
	name: 'authors',
	schema: {
		firstName: 'String',
		lastName: 'String',
		birthday: 'Date'
	},
	ref: [{
		$id: 'authors',
		title: 'Authors - Model',
		properties: {
			firstName: { type: 'string' },
			lastName: { type: 'string' },
			birthday: { type: 'string', format: 'date', example: '1969-07-06' },
		},
		required: ["firstName", "lastName"],
	}],
	routeGet: {
		response: {
			200: {
				$ref: 'authors#'
			},
		},
	},
	routePost: {
		body: {
			$ref: 'authors#'
		},
		response: {
			200: {
				$ref: 'authors#'
			}
		},
	},
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
	ref: [{
		$id: 'books',
		title: 'Books - Model',
		properties: {
			title: { type: 'string' },
			isbn: { type: 'string' },
			created: { type: 'string', format: 'date', example: '1969-07-06' },
		},
		required: ["title", "isbn"],
	}],
	routeGet: {
		response: {
			200: {
				$ref: 'books#'
			},
		},
	},
	routePost: {
		body: {
			$ref: 'books#'
		},
		response: {
			200: {
				$ref: 'books#'
			}
		},
	},
};


const createSchemasInTmpPath = () => {
	const tmpPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mfas-'));
	// authors.schema.js
	fs.writeFileSync(path.join(tmpPath, 'authors.schema.js'), 
		'module.exports=' + JSON.stringify(schema_authors));
	// subdir/books.schema.js
	fs.mkdirSync(path.join(tmpPath,'subdir'));
	fs.writeFileSync(path.join(tmpPath, 'subdir', 'books.schema.js'), 
		'module.exports=' + JSON.stringify(schema_books));
	return tmpPath;
};

const tmpPath = createSchemasInTmpPath();

test('valid schemaDir', async t => {
	t.plan(1);

	t.not(tmpPath, undefined, 'schemaDir is valid');
})

test('mongoose db initialization', async t => {
	t.plan(2);

	mongooseConnection = await BackwardWrapper.createConnection(MONGODB_URL);
	t.ok(mongooseConnection);
	t.equal(mongooseConnection.readyState, 1, 'Ready state is connected(==1)'); /// connected
});

test('schema initialization', async t => {
	t.plan(2);
	const authorSchema = mongoose.Schema(schema_authors.schema);
	mongooseConnection.model('Author', authorSchema);

	const bookSchema = mongoose.Schema(schema_books.schema);
	mongooseConnection.model('Book', bookSchema);

	t.ok(mongooseConnection.models.Author);
	t.ok(mongooseConnection.models.Book);
});


test('clean up test collections', async t => {
	await mongooseConnection.models.Author.deleteMany({}).exec();
	await mongooseConnection.models.Book.deleteMany({}).exec();
});

test('initialization of API server', async t => {
	// setting up the server
	fastify = Fastify();
	// need this to handle post/put/patch request parameters
	fastify.register(fastifyFormbody);

	fastify.register(fastifyMongooseAPI, {
		models: mongooseConnection.models,
		setDefaults: true,
		schemaDirPath: tmpPath
	});

	//await fastify.ready();
	await fastify.listen(FASTIFY_PORT);
});


test('POST author item test', async t => {
	t.plan(3);
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/authors')
		.send({ firstName: 'Hutin', lastName: 'Puylo' })
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, { firstName: 'Hutin', lastName: 'Puylo' }, "POST api ok");

	response = await supertest(fastify.server)
		.get('/api/authors')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body.items[0], { firstName: 'Hutin', lastName: 'Puylo' }, "Listed same");
	t.equal(response.body.total, 1, 'There are author now');
});

test('POST only firstName', async t => {
	t.plan(1);
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/authors')
		.send({ firstName: 'Hutin' })
		.expect(400)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body.message, 'body should have required property \'lastName\'', "POST failed if required parameters not set");
});

test('POST valid birthday', async t => {
	t.plan(3);
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/authors')
		.send({ firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-07-06' })
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')
	t.match(response.body, { firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-07-06' }, "POST api ok");

	response = await supertest(fastify.server)
		.get('/api/authors')
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body.items[1], { firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-07-06' }, "Listed same");
	t.equal(response.body.total, 2, 'There are author now');
});

test('POST invalid birthday', async t => {
	t.plan(1);
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/authors')
		.send({ firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-30-06' })
		.expect(400)
		.expect('Content-Type', 'application/json; charset=utf-8')
	t.match(response.body.message, 'body.birthday should match format \"date\"', "POST api ok");
});

test('POST book item test', async t => {
	t.plan(1);
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/books')
		.send({ title: 'Critique of Practical Reason', isbn: '1519394632' })
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body, { title: 'Critique of Practical Reason', isbn: '1519394632' }, "POST api ok");
});

test('POST book without isbn', async t => {
	t.plan(1);
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/books')
		.send({ title: 'Critique of Practical Reason' })
		.expect(400)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body.message, 'body should have required property \'isbn\'', "POST failed if required parameters not set");
});

test('Shutdown API server', async t => {
	await fastify.close();
});

// now birthday is required too
schema_authors.ref[0].required = ['firstName', 'lastName', 'birthday'];

test('reload API server with schemas', async t => {
	// setting up the server
	fastify = Fastify();
	// need this to handle post/put/patch request parameters
	fastify.register(fastifyFormbody);

	fastify.register(fastifyMongooseAPI, {
		models: mongooseConnection.models,
		setDefaults: true,
		schemas: [schema_authors], // this replaces one loaded in dirPath
		schemaDirPath: tmpPath
	});

	//await fastify.ready();
	await fastify.listen(FASTIFY_PORT);
});

test('POST without birthday', async t => {
	t.plan(1);
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/authors')
		.send({ firstName: 'Hutin', lastName: 'Puylo' })
		.expect(400)
		.expect('Content-Type', 'application/json; charset=utf-8')

	t.match(response.body.message, 'body should have required property \'birthday\'', "POST failed if required parameters not set");
});

test('POST with birthday', async t => {
	t.plan(1);
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/authors')
		.send({ firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-07-06' })
		.expect(200)
		.expect('Content-Type', 'application/json; charset=utf-8')
	t.match(response.body, { firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-07-06' }, "POST api ok");
});

test('teardown', async t => {
	await fastify.close();
	await mongooseConnection.close();
	fs.unlinkSync(path.join(tmpPath, 'authors.schema.js'));
	fs.unlinkSync(path.join(tmpPath, 'subdir', 'books.schema.js'));
	fs.rmdirSync(path.join(tmpPath, 'subdir'));
	fs.rmdirSync(tmpPath);
});