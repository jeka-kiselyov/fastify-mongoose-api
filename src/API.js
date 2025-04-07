const APIRouter = require('./APIRouter.js');
const DefaultModelMethods = require('./DefaultModelMethods');
const { responseSchema404, responseSchema500 } = require('./DefaultSchemas');
const loadSchemasFromPath = require('./LoadSchemasFromPath');

class API {
    constructor(params = {}) {
        this._models = params.models;
        this._fastify = params.fastify;

        if (!this._models || !this._fastify) {
            throw 'Please initialize fastify-mongoose-api with fastify.register() with required models parameter';
        }

        this._checkAuth = params.checkAuth || null;
        this._defaultModelMethods =
            params.defaultModelMethods || DefaultModelMethods;

        this._exposeVersionKey = params.exposeVersionKey; // default = true
        if (this._exposeVersionKey === undefined) {
            this._exposeVersionKey = true;
        }

        this._exposeModelName = params.exposeModelName || false; // default = false

        this._methods = params.methods || [
            'list',
            'get',
            'post',
            'patch',
            'put',
            'delete'
        ];

        this._apiRouters = {};

        this._registerReferencedSchemas();

        this.schemas = params.schemas || [];
        if (params.schemaDirPath) {
            const schemaPathFilter = params.schemaPathFilter 
                || ((pathFile, file) => file.endsWith('.js')); // Default filter
            this.schemas = [
                ...this.schemas,
                ...loadSchemasFromPath(params.schemaDirPath, schemaPathFilter)
            ];
        }

        for (let key of Object.keys(this._models)) {
            this.addModel(this._models[key], params);
        }
    }

    get apiRouters() {
        return this._apiRouters;
    }

    _registerReferencedSchemas() {
        this._fastify.addSchema(responseSchema404);
        this._fastify.addSchema(responseSchema500);
    }

    addModel(model, params = {}) {
        let setDefaults = true;
        if (params.setDefaults === false) {
            setDefaults = false;
        }

        let checkAuth = params.checkAuth ? params.checkAuth : null;
        let prefix = params.prefix ? params.prefix : null;
        if (model.schema) {
            if (setDefaults) {
                this.decorateModelWithDefaultAPIMethods(model);
            }

            if (model.prototype.apiValues) {
                //// if model has defined:
                ////  schema.virtual('APIValues').get(function () { .... })
                //// then expose it via API
                this._apiRouters[model.modelName] = new APIRouter({
                    models: this._models,
                    model: model,
                    methods: this._methods,
                    checkAuth: checkAuth,
                    prefix: prefix,
                    fastify: this._fastify,
                    schemas: this.schemas
                        ? this.schemas.find(
                              o =>
                                  o.name.toLowerCase().replace(/s$/g, '') ===
                                  model.prototype.collection.name
                                      .toLowerCase()
                                      .replace(/s$/g, '')
                          )
                        : {}
                });

                model.prototype.__api = this;
            }
        }
    }

    decorateModelWithDefaultAPIMethods(model) {
        if (model.schema) {
            if (!model.prototype['apiValues']) {
                model.prototype['apiValues'] =
                    this._defaultModelMethods.prototype.apiValues;
            }
            if (!model.prototype['apiPut']) {
                model.prototype['apiPut'] =
                    this._defaultModelMethods.prototype.apiPut;
            }
            if (!model.prototype['apiDelete']) {
                model.prototype['apiDelete'] =
                    this._defaultModelMethods.prototype.apiDelete;
            }

            if (!model.apiPost) {
                model.apiPost = this._defaultModelMethods.apiPost;
            }
            if (!model.apiSubRoutes) {
                model.apiSubRoutes = this._defaultModelMethods.apiSubRoutes;
            }
        }
    }
}

module.exports = API;
