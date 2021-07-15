# Fastify plugin to expose API for Mongoose MongoDB models

[![npm package](https://img.shields.io/npm/v/fastify-mongoose-api.svg)](http://npmjs.org/package/fastify-mongoose-api)
[![Build Status](https://travis-ci.org/jeka-kiselyov/fastify-mongoose-api.svg?branch=master)](https://travis-ci.org/jeka-kiselyov/fastify-mongoose-api)
[![Coverage Status](https://coveralls.io/repos/github/jeka-kiselyov/fastify-mongoose-api/badge.svg?branch=master)](https://coveralls.io/github/jeka-kiselyov/fastify-mongoose-api?branch=master)
[![Dependencies Status](https://david-dm.org/jeka-kiselyov/fastify-mongoose-api/status.svg)](https://david-dm.org/jeka-kiselyov/fastify-mongoose-api)

If you are using [Fastify](https://github.com/fastify/fastify) as your server and [Mongoose](https://github.com/Automattic/mongoose) as your ODM, **fastify-mongoose-api** is the easiest solution to run API server for your models. **fastify-mongoose-api** generates REST routes with refs subroutes like `/api/author/AUTHORID/books` and `/api/books/BOOKID/author` based on MongoDB Mongoose models definitions with few lines of code.

### As simple as:
```javascript
const fastify = Fastify();
fastify.register(fastifyFormbody); /// need form body to accept API parameters
fastify.register(fastifyMongooseAPI, {  /// here we are registering our plugin
    models: mongooseConnection.models,  /// Mongoose connection models
    prefix: '/api/',                    /// URL prefix. e.g. http://localhost/api/...
    setDefaults: true,                  /// you can specify your own api methods on models, our trust our default ones, check em [here](https://github.com/jeka-kiselyov/fastify-mongoose-api/blob/master/src/DefaultModelMethods.js)
    methods: ['list', 'get', 'post', 'patch', 'put', 'delete', 'options'] /// HTTP methods
});

await fastify.ready(); /// waiting for plugins registration
await fastify.listen(8080); /// running the server
//// yep, right here we already have API server running on port 8080 with methods for all MongoDB models of your mongoose instance.
```
- [Installation](#installation)
- [Initialization and parameters](#initialization)
- Sample application ([Source code](https://github.com/jeka-kiselyov/sample-fastify-mongoose-api-app), [Live demo](https://fastify-mongoose-api-app.herokuapp.com/))
- [Auto generated method routes for sample application](#sample-application-generated-api-routes)
- [POST/PUT on frontend samples](#postput-sample-on-frontend)
- [LIST methods response](#list-method-response-sample)
- [LIST methods options (pagination, projection, sorting, filtering, regext match, populate)](#list-method-options)
- [Populate on POST, PUT and single item GET methods)](#populate-on-post-put-and-single-item-get-methods)
- [Subroutes when there're few refs to the same model)](#subroutes-when-therere-few-refs-to-the-same-model)
- [How to enable CORS for cross-domain requests?](#cors)
- [How to implement authorization?](#checkauth--function)
- [Unit tests](#tests)

## Installation

```bash
npm i fastify-mongoose-api -s
```

## Initialization

Register plugin on fastify instance:

```javascript
const fastify = Fastify();
fastify.register(fastifyFormbody);
fastify.register(fastifyMongooseAPI, options);
```

with following options:

#### .models : array of mongoose models

Required. Array of mongoose models. Usually you can get them from mongoose connection object like:
```javascript
let connection = await mongoose.createConnection(this.config.database.database, options);
/// ... register mongoose models
connection.model('Author', schema);
connection.model('Book', schema);
/// ... connection models is ready for fastify-mongoose-api
connection.models
```

#### .prefix : string (default: '/api/')

Path prefix. Default is `/api/`.

#### .setDefaults : boolean (default: true)

Initialize api with default REST methods

#### .methods : array of strings

Methods to initialize, `['list', 'get', 'post', 'patch', 'put', 'delete', 'options']` is available.

#### .checkAuth : function

Function to run before any API request to check authorization permissions in. Just throw an error in it if user is now allowed to perform an action.

```javascript

fastify.register(fastifyMongooseAPI, {
        models: this.db.connection.models,
        checkAuth: async (req, reply)=>{
          let ac = await this.db.AuthCode.findOne({authCode: req.cookies.authCode}).populate('user').exec(); /// fastify-cookie plugin for req.cookie
          if (!ac || !ac.user) {
            throw new Error('You are not authorized to be here');
          }
        }
    });
```

## Sample Application

Sample application ([Source code](https://github.com/jeka-kiselyov/sample-fastify-mongoose-api-app), [Live demo](https://fastify-mongoose-api-app.herokuapp.com/)) with Vue.js UI, simple Auth integration, ready to run on Heroku.

You can also check plugin's [unit test file](https://github.com/jeka-kiselyov/fastify-mongoose-api/blob/master/test/api.test.js).

### Sample models

We are defining two classic models. Books and author with one to many relation between them.

``` javascript
const mongoose = require('mongoose');
const mongooseConnection = await mongoose.createConnection(MONGODB_URL, { useNewUrlParser: true });

const authorSchema = mongoose.Schema({
    firstName: String,
    lastName: String,
    biography: String,
    created: { type: Date, default: Date.now }
});

const Author = mongooseConnection.model('Author', authorSchema);

const bookSchema = mongoose.Schema({
    title: String,
    isbn: String,
    author: {  type: mongoose.Schema.Types.ObjectId,  ref: 'Author' },
    created: {  type: Date, default: Date.now }
});

const Book = mongooseConnection.model('Book', bookSchema);
```
### Sample application server
Should be easy here
```javascript
const Fastify = require('fastify');
const fastifyMongooseAPI = require('fastify-mongoose-api');
const fastifyFormbody = require('fastify-formbody');

const fastify = Fastify();
fastify.register(fastifyFormbody);
fastify.register(fastifyMongooseAPI, {
    models: mongooseConnection.models,
    prefix: '/api/',
    setDefaults: true,
    methods: ['list', 'get', 'post', 'patch', 'put', 'delete', 'options']
});

await fastify.ready();
await fastify.listen(8080);
```
### Sample application generated API routes

|               | Method        | URL   |       |
| ------------- | ------------- | ----- | ----- |
| List all authors | GET | /api/authors | Pagination, sorting, search and filtering [are ready](#list-method-options) |
| List all books | GET | /api/books | Want to get populated refs in response? [You can](#populate) |
| Create new author | POST | /api/authors | Send properties with post body [sample](https://github.com/jeka-kiselyov/sample-fastify-mongoose-api-app/blob/master/frontend/src/includes/api.js#L23) |
| Create new book | POST | /api/books |  |
| Get single author | GET | /api/authors/AUTHORID | |
| Get author books | GET | /api/authors/AUTHORID/books | Plugin builds relations based on models definition |
| Get book author | GET | /api/books/BOOKID/author | Same in reverse way |
| Update author | PUT | /api/authors/AUTHORID | Send properties using post body |
| Update book | PUT | /api/books/BOOKID |   |
| Delete book | DELETE | /api/books/BOOKID | Be careful |
| Delete author | DELETE | /api/authors/AUTHORID |   |

## Post/Put sample on frontend

```javascript
await axios.post('/api/books', {title: 'The Book'});
await axios.put('/api/books/xxxxx', {title: 'The Book Updated'});
await axios.put('/api/books/xxxxx', {title: 'The Book Updated'}, {params: {populate: 'author'}});

```

## List method response sample

Sample API response for `List all authors` method:

```javascript
{ total: 2,
  items:
   [ { _id: '5d2620aff4df8b3c4f4f03d6',
       created: '2019-07-10T17:30:23.486Z',
       firstName: 'Jay',
       lastName: 'Kay',
       biography: 'Lived. Died.',
       __v: 0 },
     { _id: '5d2620aff4df8b3c4f4f03d8',
       created: '2019-07-10T17:30:23.566Z',
       firstName: 'Hutin',
       lastName: 'Puylo',
       biography: 'The Little One',
       __v: 0 } ] }
```

## List method options

Pass all options as URL GET parameters, e.g. /api/books?option=some&option2=better Works very same for other LIST routes, `/api/authors/AUTHORID/books` etc.

### Pagination

|         | Option Name | Default Value |
| ------- | ----------- | ------------- |
| Offset  | offset      | 0             |
| Limit   | limit       | 100           |

### Sorting

Pass sort option string as described in [Mongoose docs](https://mongoosejs.com/docs/api.html#query_Query-sort), e.g. 'name' for sorting by name field or '-name' for descending sort by it.

|         | Option Name | Default Value |
| ------- | ----------- | ------------- |
| Sort    | sort        | null          |

### Filtering

Simple filtering by field value is available. /api/books?filter=isbn%3Dsomeisbnval will return all books with isbn equals to 'someisbnval'. %3D here is urlencoded '=' symbol, so actual option value is 'isbn=someisbnval'

|         | Option Name | Default Value |
| ------- | ----------- | ------------- |
| Filter  | filter      | null          |


### Regex match

Use it for pattern matching. Useful for things like autocomplete etc. [Check mongodb docs](https://docs.mongodb.com/manual/reference/operator/query/regex/#pcre-vs-javascript) how to pass regex options in pattern string, e.g. `(?i)pattern` to turn case-insensitivity on. Pass param in the same way as for filtering, `/api/authors?match=lastName%3D(?i)vonnegut`

|         | Option Name | Default Value |
| ------- | ----------- | ------------- |
| Regex   | match       | null          |

### Search

Performs search by [full text mongodb indexes](https://docs.mongodb.com/manual/core/index-text/). First you have to [specify one or few text indexes](https://stackoverflow.com/a/28775709/1119169) in your model schema. You don't have to specify field name for this parameter, mongo will perform full text search on all available indexes.

|         | Option Name | Default Value |
| ------- | ----------- | ------------- |
| Search  | search      | null          |

### Projection

Projects the first element in an array that matches the field. `/api/authors?fields=firstName,lastName` will only return `_id, firstName, lastName`. You can also exclude fields by using `-`, i.e. `?fields=-firstName` which will return everything except the `firstName` field.

|          | Option Name | Default Value |
| -------- | ----------- | ------------- |
|Projection| fields      | null          |

### Populate

If you want API response to include nested objects, just pass populate string in parameter, it will run `populate(param)` before sending response to client. To populate few fields, pass them as array, `?populate[]=author&populate[]=shop`

|         | Option Name | Default Value |
| ------- | ----------- | ------------- |
| Populate| populate    | null          |


## Populate on POST, PUT and single item GET methods

Works very same, just send your form(object) data in formBody and populate parameter in query string:

```javascript
  $.post('/api/books?populate=author', {
      title: 'The best book',
      isbn: '1482663775',
      author: '5d62e5e4dab2ce6a1b958461'
    });
```

and get a response of:

```json
{
  "_id":"5d62f39c20672b3cf2822ded",
  "title":"The best book",
  "isbn":"1482663775",
  "author":{
    "_id":"5d62e5e4dab2ce6a1b958461",
    "firstName":"Jay",
    "lastName":"Holmes"}
  }
```

works very same, you can also pass `populate[]` array to populate few fields.

## Subroutes when there're few refs to the same model

By default, fastify-mongoose-api creates subroutes for external refs to your models, [sample](#sample-application-generated-api-routes). But what if there're few refs to the same model in your schema? Like:

```javascript
  const bookSchema = mongoose.Schema({
    title: String,
    isbn: String,
    author: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Author'
      },
    coauthor: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Author'
      },
    created: {
      type: Date,
      default: Date.now
    }
  });
  const Book = mongooseConnection.model('Book', bookSchema);
```

In this special case, it will create extra routes:

`/api/author/AUTHORID/books` - to list books where AUTHORID is the author (the first ref defined)
and
`/api/author/AUTHORID/books_as_coauthor` - to list books where AUHTORID is the co-author (next ref to the same model)

while keeping expected internal refs GET routes of `/api/books/BOOKID/author` and `/api/books/BOOKID/coauthor`

## CORS

How to enable CORS for cross-domain requests? [fastify-cors](https://github.com/fastify/fastify-cors) works just fine:

```javascript
  const fastify = Fastify();
  fastify.register(fastifyFormbody);
  fastify.register(require('fastify-cors'), {
      // put your options here
  });

  fastify.register(fastifyMongooseAPI, {
          models: this.db.connection.models,
          prefix: '/api/',
          setDefaults: true,
          methods: ['list', 'get', 'post', 'patch', 'put', 'delete', 'options']
      });

  await fastify.ready();
  await fastify.listen(args.port);
```

## Tests

Clone fastify-mongoose-api, run `npm install` in its directory and run `grunt` or `npm test` to run [unit tests](https://github.com/jeka-kiselyov/fastify-mongoose-api/tree/master/test), or `grunt watchtests` to run unit tests on each file change (development mode).

## Coverage report

Simply run `npm test` with the COVERALLS_REPO_TOKEN environment variable set and tap will automatically use nyc to report coverage to coveralls.

## License

Licensed under [MIT](./LICENSE)