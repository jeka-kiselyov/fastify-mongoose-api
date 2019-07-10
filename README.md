# Fastify plugin to expose API for Mongoose MongoDB models

### As simple as:
```javascript
    const fastify = Fastify();
    fastify.register(fastifyFormbody); /// need form body to accept API parameters
    fastify.register(fastifyMongooseAPI, {  /// here we are registering our plugin
        models: mongooseConnection.models,  /// Mongoose connection models
        prefix: '/api/',                    /// URL prefix. e.g. http://localhost/api/...
        setDefaults: true,                  /// you can specify your own api methods on models, our trust our default ones (check em here)
        methods: ['list', 'get', 'post', 'patch', 'put', 'delete', 'options'] /// HTTP methods
    });

    await fastify.ready(); /// waiting for plugins registration
    await fastify.listen(8080); /// running the server
    //// yep, right here we already have API server running on port 8080 with methods for all MongoDB models of your mongoose instance.
```
## Installation

```bash
npm i fastify-mongoose-api -s
```

## Sample Application 

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

|         | Method           | URL  |    |
| ------------- |:-------------:| -----:| -----:| 
| List all authors | GET | http://localhost:8080/api/authors | Pagination, sorting and filtering are ready ( todo: link to doc section ) |
| List all books | GET | http://localhost:8080/api/books |   |
| Create new author | POST | http://localhost:8080/api/authors | Send properties using FormData ( todo: link to sample code ) |
| Create new book | POST | http://localhost:8080/api/books |  |
| Get single author | GET | http://localhost:8080/api/authors/5d1dd920bfff30ff2ffb8593 | |
| Get author books | GET | http://localhost:8080/api/authors/5d1dd920bfff30ff2ffb8593/books | Plugin build relations based on models definition |
| Get book author | GET | http://localhost:8080/api/books/6a1aa920bfff30ff2ffb81af/author | Same in reverse way |
| Update author | PUT | http://localhost:8080/api/authors/5d1dd920bfff30ff2ffb8593 | Send properties using FormData |
| Update book | PUT | http://localhost:8080/api/books/6a1aa920bfff30ff2ffb81af |   |
| Delete book | DELETE | http://localhost:8080/api/books/6a1aa920bfff30ff2ffb81af | Be careful |
| Delete author | DELETE | http://localhost:8080/api/authors/5d1dd920bfff30ff2ffb8593 |   |

## License

Licensed under [MIT](./LICENSE)