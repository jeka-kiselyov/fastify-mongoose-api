import APIRouter from './APIRouter.js';
import DefaultModelMethods from './DefaultModelMethods.js';
import { responseSchema404, responseSchema500 } from './DefaultSchemas.js';
import { loadSchemasFromPath } from './LoadSchemasFromPath.js';
import {TFMAApiOptions, TFMASchema, TFMASchemas;IAPI} from '../types.js';

class API implements IAPI {
    private _models: TFMAApiOptions['models'];
    private _fastify: TFMAApiOptions['fastify'];
    private _checkAuth: TFMAApiOptions['checkAuth'];
    private _exposeVersionKey: TFMAApiOptions['exposeVersionKey'];
    private _defaultModelMethods: typeof DefaultModelMethods;
    private _exposeModelName: TFMAApiOptions['exposeModelName'];
    private _methods: TFMAApiOptions['methods'];
    private _apiRouters: Record<string, APIRouter>;
    private schemas: TFMASchemas[];

    public static create(params: TFMAApiOptions) {
        return new API(params).init(params);
    }

    constructor(params: TFMAApiOptions) {
        this._models = params.models;
        this._fastify = params.fastify;
        this._checkAuth = params.checkAuth || undefined;
        this._defaultModelMethods = DefaultModelMethods;

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
    }

    private async init(params: TFMAApiOptions) {
        if (params.schemaDirPath)
            this.schemas = [
                ...this.schemas,
                ...await loadSchemasFromPath(params.schemaDirPath)
            ];

        for (const key of Object.keys(this._models)) {
            const model = this._models[key];
            model && this.addModel(model, params);
        }

        return this;
    }

    get apiRouters() {
        return this._apiRouters;
    }

    _registerReferencedSchemas() {
        this._fastify.addSchema(responseSchema404);
        this._fastify.addSchema(responseSchema500);
    }

    addModel(model:TFMASchema, params: TFMAApiOptions) {
        let setDefaults = true;
        if (params.setDefaults === false) {
            setDefaults = false;
        }

        const checkAuth = params.checkAuth ? params.checkAuth : null;
        const prefix = params.prefix ? params.prefix : null;
        if (model.schema) {
            if (setDefaults) {
                this.decorateModelWithDefaultAPIMethods(model);
            }

            if (model.apiValues) {
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

    decorateModelWithDefaultAPIMethods(model: TFMASchema) {
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

export default API;
