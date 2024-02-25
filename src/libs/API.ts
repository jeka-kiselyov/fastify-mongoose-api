import APIRouter from './APIRouter.js';
import DefaultModelMethods from './DefaultModelMethods.js';
import { responseSchema404, responseSchema500 } from './DefaultSchemas.js';
import { loadSchemasFromPath } from './LoadSchemasFromPath.js';
import { TFMAApiOptions, TFMASchemas, IAPI, TFMAModel, TFMAModelMethodsKeys } from '../types.js';

class API implements IAPI {
    private _models: TFMAApiOptions['models'];
    private _fastify: TFMAApiOptions['fastify'];
    private _checkAuth: TFMAApiOptions['checkAuth'] | undefined;
    private _exposeVersionKey: TFMAApiOptions['exposeVersionKey'];
    // private _defaultModelMethods: typeof DefaultModelMethods;
    // private _exposeModelName: TFMAApiOptions['exposeModelName'];
    private _methods: TFMAApiOptions['methods'];
    private _apiRouters: Record<string, APIRouter>;
    private schemas: TFMASchemas[];

    public static create(params: TFMAApiOptions) {
        return new API(params).init(params);
    }

    constructor(params: TFMAApiOptions) {
        this._models = params.models;
        this._fastify = params.fastify;
        this._checkAuth = params.checkAuth;
        // this._defaultModelMethods = DefaultModelMethods;

        this._exposeVersionKey = params.exposeVersionKey; // default = true
        if (this._exposeVersionKey === undefined) {
            this._exposeVersionKey = true;
        }

        // this._exposeModelName = params.exposeModelName || false; // default = false

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

    addModel(model: TFMAModel, params: TFMAApiOptions) {
        let setDefaults = true;
        if (params.setDefaults === false) {
            setDefaults = false;
        }
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
                    checkAuth: this._checkAuth,
                    prefix: params.prefix, // Update the type of prefix to allow for undefined
                    fastify: this._fastify,
                    schema: this.schemas
                        ? this.schemas.find(
                            o =>
                                o.name.toLowerCase().replace(/s$/g, '') ===
                                model.collection!.name
                                    .toLowerCase()
                                    .replace(/s$/g, '')
                        )
                        : undefined
                });

                model.__api = this;
            }
        }
    }

    decorateModelWithDefaultAPIMethods(model: TFMAModel) {
        if (model.schema) {
            const methods: TFMAModelMethodsKeys[] = [
                'apiValues',
                'apiPut',
                'apiDelete',
                'apiPost',
                'apiSubRoutes'
            ];
            for (const method of methods) {
                // TODO: fix this 
                model[method] ??= DefaultModelMethods[method] as any; 
            }
        }
    }
}

export default API;
