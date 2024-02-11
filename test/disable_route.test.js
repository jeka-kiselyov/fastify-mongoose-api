'use strict';

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

        let doc = new bw.conn.models.WhereTest();

        bw.conn.models.WhereTest.schema.eachPath(pathname => {
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

    bw.conn.model('WhereTest', schema);
    t.ok(bw.conn.models.WhereTest);
});

test('clean up test collections', async () => {
    await bw.conn.models.WhereTest.deleteMany({}).exec();
});

test('initialization of API server', async t => {
    await bw.createServer({
        models: bw.conn.models
    });

    t.equal(
        bw.fastify.mongooseAPI.apiRouters.WhereTest.collectionName,
        'wheretests',
        'Collection name used in API path'
    );
});

test('Disabled POST item test', async t => {
    let response = null;
    response = await bw.inject(
        t,
        {
            method: 'POST',
            url: '/api/wheretests',
            payload: { name: 'Bob', appleCount: 1, bananaCount: 2 }
        },
        500
    );

    t.equal(
        response.statusCode,
        500,
        "doesn't let you post without extra header"
    );

    response = await bw.inject(t, {
        method: 'POST',
        url: '/api/wheretests',
        headers: { letmepostplease: 'pleaaaaase' },
        payload: { name: 'Bob', appleCount: 1, bananaCount: 2 }
    });

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
    const response = await bw.inject(t, {
        method: 'POST',
        url: '/api/wheretests',
        headers: {
            letmepostplease: 'pleaaaaase',
            givememoredataplease: 'pleaaaaase'
        },
        payload: { name: 'Bob', appleCount: 1, bananaCount: 2 }
    });

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
    let itemFromDb = await bw.conn.models.WhereTest.findOne({});

    await bw.inject(
        t,
        {
            method: 'PUT',
            url: '/api/wheretests/' + itemFromDb.id,
            payload: { name: 'Bob22', appleCount: 21, bananaCount: 22 }
        },
        500
    );
});

test('Disabled DELETE test', async t => {
    let itemFromDb = await bw.conn.models.WhereTest.findOne({});

    await bw.inject(
        t,
        {
            method: 'DELETE',
            url: '/api/wheretests/' + itemFromDb.id
        },
        500
    );
});
