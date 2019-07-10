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
    await fastify.listen(args.port); /// running the server
    //// yep, right here we already have API server with methods for all MongoDB models of your mongoose instance.
```
## Installation

```bash
npm i fastify-mongoose-api -s
```


## License

Licensed under [MIT](./LICENSE)