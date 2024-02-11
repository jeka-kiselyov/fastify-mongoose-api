# Fastify plugin to expose API for Mongoose MongoDB models

[![npm package](https://img.shields.io/npm/v/fastify-mongoose-api.svg)](http://npmjs.org/package/fastify-mongoose-api)
[![Build workflow](https://github.com/jeka-kiselyov/fastify-mongoose-api/actions/workflows/build.yml/badge.svg)](https://github.com/jeka-kiselyov/fastify-mongoose-api/actions/workflows/build.yml)
[![Coverage Status](https://coveralls.io/repos/github/jeka-kiselyov/fastify-mongoose-api/badge.svg?branch=master)](https://coveralls.io/github/jeka-kiselyov/fastify-mongoose-api?branch=master)
![Last Commit](https://img.shields.io/github/last-commit/jeka-kiselyov/fastify-mongoose-api)
![Dependencies](https://img.shields.io/librariesio/github/jeka-kiselyov/fastify-mongoose-api)
![Downloads](https://img.shields.io/npm/dt/fastify-mongoose-api)

If you are using [Fastify](https://github.com/fastify/fastify) as your server and [Mongoose](https://github.com/Automattic/mongoose) as your ODM, **fastify-mongoose-api** is the easiest solution to run API server for your models. **fastify-mongoose-api** generates REST routes with refs subroutes like `/api/author/AUTHORID/books` and `/api/books/BOOKID/author` based on MongoDB Mongoose models definitions with few lines of code.

### As simple as:
```javascript
const fastify = Fastify();
fastify.register(fastifyFormbody); /// need form body to accept API parameters, both fastify-formbody and @fastify/formbody would work here
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
- [LIST methods options (pagination, projection, sorting, filtering, complex where, search, regex match, populate)](#list-method-options)
- [Handle extra LIST cases, custom filtering etc](#handle-extra-cases)
- [Validation and serialization](#validation-and-serialization)
- [Disable/Limit some routes/methods](#disable-some-routesmethods)
- [Populate on POST, PUT and single item GET methods)](#populate-on-post-put-and-single-item-get-methods)
- [Subroutes when there're few refs to the same model)](#subroutes-when-therere-few-refs-to-the-same-model)
- [How to hide document properties/fields in API response?](#how-to-hide-specific-fieldsproperties-in-api-response)
- [How can I post/put nested paths?](#how-can-i-post-or-put-nested-paths-and-their-properties)
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
fastify.register(fastifyFormbody); // both fastify-formbody and @fastify/formbody would work
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

#### .exposeVersionKey : boolean (default: true)

Show documents `__v` in API response

#### .exposeModelName : boolean | string (default: false)

Show mongoose Model Name property in API response. Default property name is `.__modelName` , specify exposeModelName as string to name this field as custom.

If `true` it adds `__modelName` to all responses (get, list, post/put, populated too):

```javascript

{ total: 1,
  items:
   [ { _id: '5d2620aff4df8b3c4f4f03d6',
       created: '2019-07-10T17:30:23.486Z',
       firstName: 'Jay',
       lastName: 'Kay',
       biography: 'Lived. Died.',
       __modelName: 'Author'
       __v: 0 },
    ]
}
```

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

#### .schemas: array of objects

Enable support for fastify [validation and serialization](#validation-and-serialization). If `.schemaDirPath` is defined, these explicitly defined here have precedence.

#### .schemaDirPath: string

Directory where it's possible to define schemas for [validation and serialization](#validation-and-serialization) in separate files. The directory will be trasverse includes all subdirectories.

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

#### Filtering by Boolean property

Though you pass property value directly as boolean to create new entity or update one:
```javascript
await axios.post('/api/books', {title: 'Some Book', isGood: false});
```

Filtering by that value may be implemented using number representation of boolean (0/1):
```javascript
await axios.get('/api/books', {params: {filter: 'isGood=0'}});
```

See [test case](https://github.com/jeka-kiselyov/fastify-mongoose-api/blob/master/test/boolean_fields.test.js)

### Complex Where Queries

Pass mongo where object as `where` property JSON-encoded string and it will be added to list filters.
`where: "{\"count\": 2}"` or `JSON.stringify({$and: [{appleCount: {$gt: 1}}, {bananaCount: {$lt: 5}}]})`

Plugin uses simple sanitation, list of allowed operators:
```javascript
  '$eq', '$gt', '$gte', '$in', '$lt', '$lte', '$ne', '$nin', '$and', '$not', '$nor', '$or', '$exists'
```

See [Mongo operators docs](https://www.mongodb.com/docs/manual/reference/operator/query/#query-and-projection-operators)
And plugin [test case](https://github.com/jeka-kiselyov/fastify-mongoose-api/blob/master/test/complex_where.test.js)
for more info.


|         | Option Name | Default Value |
| ------- | ----------- | ------------- |
| Where   | where       | null          |

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

### Handle extra cases

You can create hook method on any model to handle its List requests.

```javascript
  schema.statics.onListQuery = async function(query, request) {
      let notSeen = request.query.notSeen ? request.query.notSeen : null;
      if (notSeen) {
          query = query.and({sawBy: {$ne: request.user._id}});
      }
  }
```
query is Mongoose query object, so you can extend it by any [query object's methods](https://mongoosejs.com/docs/api.html#Query) depending on your state or request data.

Note: **do not** return anything in this method.

## Validation and Serialization

Generated API can support standard fastify validation and serialization via `.schemas` option.

If you are not confidable with fastify validation and serialization logics, see [documentation](https://www.fastify.io/docs/latest/Reference/Validation-and-Serialization/).

If you don't set some schemas, API works without validation (except, of course, that inherent in the db schema).

If you wish to add a validation and/or a serialization schema for your api you should add an object to `.schemas` array or set a directory where automatically load schemas with `.schemaDirPath`:

```javascript

fastify.register(fastifyMongooseAPI, {
  models: this.db.connection.models,
  schemas: [
    {
      name: 'collection_name',
      routeGet:    {},
	    routePost:   {},
	    routeList:   {},
	    routePut:    {},
	    routePatch:  {},
	    routeDelete: {},
    },
    { name: 'another_collection_name',
      ...
    },
    ...
  ],
  schemaDirPath: '/path/to/your/schemas',

```

where `name` is the collection to which this schema will be applied and `route*` are the validation and/or serialization schemas for related restful http verbs.

If you omit one of these, the related verbs will be generated *without* a schema. 

If you set to empty one, [these](src/DefaultSchemas.js) defaults will be added.

If you set an not empty one, it will be merged with defaults, with, obviously, custom parameters with precedence.

As an example, it declares author first and last name as required. We should implement this in `POST`, `PUT` and `PATCH` verbs. Do this for `POST` only

```javascript

const schemas = {
  name: 'authors',
  routePost: {
    body: {
      properties: {
        firstName: { type: 'string' },
        lastName:  { type: 'string' },
        biography: { type: 'string' }
      },
      required: ['firstName', 'lastName']
    }
  }
};

fastify.register(fastifyMongooseAPI, {
  models: this.db.connection.models,
  schemas: schemas
});

```

Add a serialization to `POST` reply  (errors (404/500) are managed by defaults).

```javascript

const schemas = {
  name: 'authors',
  routePost: {
    body: {
      properties: {
        firstName: { type: 'string' },
        lastName:  { type: 'string' },
        biography: { type: 'string' }
      },
      required: ['firstName', 'lastName']
    },
    response: {
      200: {
        properties: {
          firstName: { type: 'string' },
          lastName:  { type: 'string' },
          biography: { type: 'string' }
        }
      }
    }
  }
};
```

As you can see taking a look to defaults, this plugin supports the URI [references](https://datatracker.ietf.org/doc/html/draft-handrews-json-schema-01#section-8) `$ref` to other schemas.

You can add manually these references through `fastify.addSchema(schema)` or automatically if your schema has a `ref` attribute.

This attribute could be a single object or an array of objects if you wish to register more references at once.

So it's possibile to simplify our example moving duplicated data into a reference

```javascript

const schemas = {
  name: 'authors',
  ref: {
    $id: 'authorsModel',
    properties: {
      firstName: { type: 'string' },
      lastName:  { type: 'string' },
      biography: { type: 'string' }
    },
    required: ['firstName', 'lastName']
  },
  routePost: {
    body: { $ref: 'authorsModel#' },
    response: {
      200: { $ref: 'authorsModel#' }
    }
  }
};
```
If `.schemas` and `schemaDirPath` are used together, the schemas defined in `.schemas` have precedence to there loaded in `schemaDirPath`.

The generated validation and serialization is compatible with other plugins like [@fastify/swagger](https://github.com/fastify/fastify-swagger) and [@fastify/swagger-ui](https://github.com/fastify/fastify-swagger-ui) for automatically serving OpenAPI v2/v3 schemas

It's obviously possibile to merge MongoDB schemas and validation schemas in the same object

```javascript

const authorSchema = {
  name: 'authors',
  schema: {
    firstName: String,
    lastName: String,
    biography: String,
    created: { type: Date, default: Date.now }
  },
  ref: {
    $id: 'authorsModel',
    properties: {
      firstName: { type: 'string' },
      lastName:  { type: 'string' },
      biography: { type: 'string' }
    },
    required: ['firstName', 'lastName']
  },
  routePost: {
    body: { $ref: 'authorsModel#' },
    response: {
      200: { $ref: 'authorsModel#' }
    }
  }
};

const Author = mongooseConnection.model('Author', authorSchema.schema);

fastify.register(fastifyMongooseAPI, {
  models: this.db.connection.models,
  schemas: [ authorSchema, ... ]
});

```

with the single caution, for newer avj versions, to disable strict mode so avj ignore the `schema` attribute


```javascript

const fastify = Fastify({
  ajv: {
    customOptions: {
      strictSchema: false,
    }
  }
});

```

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

## Disable some routes/methods

Plugin decorates every model with default methods for Post, Put and Delete, [apiPost](https://github.com/jeka-kiselyov/fastify-mongoose-api/blob/master/src/DefaultModelMethods.js#L91), [apiPut](https://github.com/jeka-kiselyov/fastify-mongoose-api/blob/master/src/DefaultModelMethods.js#L170) and [apiDelete](https://github.com/jeka-kiselyov/fastify-mongoose-api/blob/master/src/DefaultModelMethods.js#L187).

```
Post   - schema.statics.apiPost = async(data, request)
Put    - schema.methods.apiPut = async(data, request)
Delete - schema.methods.apiDelete = async(request)
```

But you can define your own methods on any model, so the simple one of:

```javascript
  schema.methods.apiPut = async function(data, request) {
    // disable the Put completely
    throw new Error('PUT is disabled for this route');
  };
  schema.methods.apiDelete = async function(request) {
    // disable the Put completely
    throw new Error('DELETE is disabled for this route');
  };
```

would disable the PUT and DELETE methods for model's API route, returing status of 500 with error message.

You can also define any custom logic based on request's object (auth, user access levels etc) or data itself (disabling some fields upading etc):

```javascript
  schema.statics.apiPost = async function(data, request) {
    if (!request.headers['letmepostplease']) {
      throw new Error('POST is disabled for you!');
    }

    let doc = new mongooseConnection.models.WhereTest;

    mongooseConnection.models.WhereTest.schema.eachPath((pathname) => {
      if (data[pathname] !== undefined) {
        doc[pathname] = data[pathname];
      }
    });

    await doc.save();
    return doc;
  };
```

Check out the [test case](https://github.com/jeka-kiselyov/fastify-mongoose-api/blob/master/test/disable_route.test.js) to see how it works in action.


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

## How can I POST or PUT nested paths and their properties?

Use dot notation. So `biography.description` or `biography.born` like:

```javascript
  await axios.post('/api/authors', {
    firstName: 'Some',
    firstName: 'Author',
    "biography.description": 'Had a happy live',
    "biography.born": 1960,
  });
```

works for creating such schema:

```javascript
  const authorSchema = mongoose.Schema({
    firstName: String,
    lastName: String,
    biography: { description: String, born: Number },
    created: {
      type: Date,
      default: Date.now
    }
  });
```

Thanks to [EmilianoBruni](https://github.com/EmilianoBruni) for implementation.

## How to hide specific fields/properties in API response

fastify-mongoose-api adds [.apiValues(request)](https://github.com/jeka-kiselyov/fastify-mongoose-api/blob/master/src/DefaultModelMethods.js) method to every mongoose model without it. You can define your own:

```javascript
  const bookSchema = mongoose.Schema({
    title: String,
    isbn: String,
    created: {
      type: Date,
      default: Date.now
    },
    password: String,
  });

  // we defined apiValues response change to check if it works for refs response
  bookSchema.methods.apiValues = function(request) {
    const object = this.toObject({depopulate: true});
    object.isbn = 'hidden';
    delete object.password;

    return object;
  };
```

so it will always display `isbn` value as `hidden` in API response and never show anything for `password` field.

As `request` is present, you can return different properties depending on request or your application state. Simpliest is:

```javascript

  schema.methods.apiValues = function (request) {
    if (!request.headers['givememoredataplease']) {
      return {
        name: this.name,
      };
    }

    return this.toObject();
  };

```

will return the full object only if `givememoredataplease` HTTP header is present in the request. You can add some access level checking on your signed in
user for more advanced flows:

```javascript

  schema.methods.apiValues = function (request) {
    if (!request.user.hasRightsToViewMoreFields()) {
      return {
        name: this.name,
      };
    }
    return this.toObject();
  };

```


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
