'use strict'

const fastifyMongooseAPI = require('../fastify-mongoose-api.js');

const t = require('tap');
const { test } = t;
const supertest = require('supertest');

const Fastify = require('fastify');
const mongoose = require('mongoose');
const fastifyFormbody = require('@fastify/formbody');

const FASTIFY_PORT = 3137;
const MONGODB_URL = process.env.DATABASE_URI || 'mongodb://127.0.0.1/fastifymongooseapitest';

const BackwardWrapper = require('./BackwardWrapper.js');

let mongooseConnection = null;
let fastify = null;

let collection = 'authors'

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
	routeDelete: {},
};

let schema_with_ref = {
	...schema_base,
	ref: [{
		$id: collection,
		title: collection + ' - Model',
		properties: {
			firstName: { type: 'string' },
			lastName: { type: 'string' },
			birthday: { type: 'string', format: 'date', example: '1969-07-06' },
		},
		required: ["firstName", "lastName"],
	}]
};

let schema_full = {
	...schema_with_ref,
	routeGet: {
		response: {
			200: {
				$ref: `${collection}#`,
			},
		},
	},
	routePost: {
		body: {
			$ref: `${collection}#`,
		},
		response: {
			200: {
				$ref: `${collection}#`,
			}
		},
	},

	routeList: {
		response: {
			200: {
				total: { type: 'integer', example: "1" },
				items: {
					type: 'array',
					items: { $ref: `${collection}#` }
				}
			}
		}
	},

	routePut: {
		body: {
			$ref: `${collection}#`,
		},
		response: {
			200: {
				$ref: `${collection}#`,
			},
		},
	},


	routePatch: {
		body: {
			$ref: `${collection}#`,
		},
		response: {
			200: {
				$ref: `${collection}#`,
			}
		}
	},

	routeDelete: {
	},
};


test('mongoose db initialization', async t => {
	t.plan(2);

	mongooseConnection = await BackwardWrapper.createConnection(MONGODB_URL);
	t.ok(mongooseConnection);
	t.equal(mongooseConnection.readyState, 1, 'Ready state is connected(==1)'); /// connected
});

test('schema initialization', async t => {
	// t.plan(2);

	// const biographyEpochSchema = mongoose.Schema({ title: String, year: Number });

	const authorSchema = mongoose.Schema(schema_base.schema);

	const Author = mongooseConnection.model('Author', authorSchema);

	t.ok(mongooseConnection.models.Author);
});


// base, empty, with_ref should have old working mode

//[schema_base, schema_empty, schema_with_ref].forEach(schema => {
[schema_base, schema_empty, schema_with_ref].forEach(schema => {
	test('clean up test collections', async t => {
		await mongooseConnection.models.Author.deleteMany({}).exec();
	});

	test('initialization of API server', async t => {
		///// setting up the server
		fastify = Fastify();
		//
		// // //// need this to handle post/put/patch request parameters
		fastify.register(fastifyFormbody);

		fastify.register(fastifyMongooseAPI, {
			models: mongooseConnection.models,
			setDefaults: true,
			schemas: [schema]
		});

		//await fastify.ready();
		await fastify.listen(FASTIFY_PORT);
	});


	test('POST item test', async t => {
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

	test('NO validation so, also a field is valid', async t => {
		let response = null;
		response = await supertest(fastify.server)
			.post('/api/authors')
			.send({ firstName: 'Hutin' })
			.expect(200)
			.expect('Content-Type', 'application/json; charset=utf-8')

		t.match(response.body, { firstName: 'Hutin' }, "POST api ok");
	});

	test('POST valid birthday', async t => {
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

		t.match(response.body.items[2], { firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-07-06' }, "Listed same");
		t.equal(response.body.total, 3, 'There are author now');
	});

	test('POST invalid birthday', async t => {
		let response = null;
		response = await supertest(fastify.server)
			.post('/api/authors')
			.send({ firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-30-06' })
			.expect(500); // got a internal server error

		t.type(response.body.message, 'string');
		// it may be a simple:
		// "Cast to date failed"
		// or something like:
		// "Author validation failed: birthday: Cast to Date failed for value \"1969-30-06\" at path \"birthday\""
		// depending on Fastify ( ajv ? ) version.
		// So let's just check if there's "Cast to date failed" in the message
		t.match(response.body.message, /[\s\S]*Cast to [Dd]ate failed[\s\S]*/);
	});

	test('Shutdown API server', async t => {
		await fastify.close();
	});
});

test('clean up test collections', async t => {
	await mongooseConnection.models.Author.deleteMany({}).exec();
});

test('initialization of API server with validation', async t => {
	///// setting up the server
	fastify = Fastify();
	//
	// // //// need this to handle post/put/patch request parameters
	fastify.register(fastifyFormbody);

	fastify.register(fastifyMongooseAPI, {
		models: mongooseConnection.models,
		setDefaults: true,
		schemas: [schema_full]
	});

	//await fastify.ready();
	await fastify.listen(FASTIFY_PORT);
});

test('Check required validation', async t => {
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/authors')
		.send({ firstName: 'Hutin' })
		.expect(400)

	t.match(response.body.message, "body should have required property 'lastName'", "POST refused");
});

test('POST valid birthday', async t => {
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

	t.match(response.body.items[0], { firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-07-06' }, "Listed same");
	t.equal(response.body.total, 1, 'There are author now');
});

test('POST invalid birthday', async t => {
	let response = null;
	response = await supertest(fastify.server)
		.post('/api/authors')
		.send({ firstName: 'Hutin', lastName: 'Puylo', birthday: '1969-30-06' })
		.expect(400)
		.expect('Content-Type', 'application/json; charset=utf-8')
	t.match(response.body.message, 'body.birthday should match format \"date\"', "POST api ok");
});

test('teardown', async t => {
	await fastify.close();
	await mongooseConnection.close();
});