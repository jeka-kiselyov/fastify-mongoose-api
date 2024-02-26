import { defaultSchemas } from './DefaultSchemas.js'
import type { FastifyGenRequest, FastifyGenReply, FastifyIdRequest, TFMAModelMethods, TFMAApiRouterOptions, TFMAModel,  TFMASchema, TFMASchemaVerbs, TFMAModelMethodsKeys, QueryList, QuerySelector, QueryFilter } from '../types.js';
import { Query } from 'mongoose';
const capFL = (param: string): string => param.charAt(0).toUpperCase() + param.slice(1);

class APIRouter {
    private _fastify: TFMAApiRouterOptions['fastify'];
    private _model: TFMAModel;
    private _methods: TFMAApiRouterOptions['methods'];
    private _checkAuth: TFMAApiRouterOptions['checkAuth'];
    private _schema: TFMAApiRouterOptions['schema'];
    private _modelName: string;
    private _prefix: string;
    private _collectionName: string;
    private _path: string;
    private _apiSubRoutesFunctions: TFMAModelMethods;
    private _defaultSchemas: ReturnType<typeof defaultSchemas>;

    constructor(params: TFMAApiRouterOptions) {
        this._fastify = params.fastify;
        this._model = params.model;
        this._methods = params.methods;
        this._checkAuth = params.checkAuth;
        this._schema = params.schema;
        this._registerReferencedSchemas();

        this._modelName = this._model.modelName;

        this._prefix = params.prefix ?? '/api/';

        this._collectionName = this._model.collection!.name;

        this._path = this._prefix + this._collectionName;

        this._apiSubRoutesFunctions = {};
        this._defaultSchemas = defaultSchemas(this._modelName);
        this.setUpRoutes();
    }

    get collectionName() {
        return this._collectionName;
    }

    get path() {
        return this._path;
    }

    _registerReferencedSchemas() {
        const s = this._schema;
        if (s && s.ref) {
            if (!Array.isArray(s.ref)) s.ref = [s.ref];
            s.ref.forEach(item => this._fastify.addSchema(item));
        }
    }

    setUpRoutes() {
        let path = this._path;
        this._methods && this._methods.forEach(item => {
            const verb = 'route' + capFL(item) as TFMASchemaVerbs;
            return this._fastify[item === 'list' ? 'get' : item](
                path + (item == 'list' || item == 'post' ? '' : '/:id'),
                this._populateSchema(verb, this._schema![verb]),
                this.routeHandler(verb)
            )
        });

        /// check if there's apiSubRoutes method on the model
        if (this._model['apiSubRoutes']) {
            this._apiSubRoutesFunctions = this._model['apiSubRoutes']();

            const keys = Object.keys(this._apiSubRoutesFunctions) as TFMAModelMethodsKeys[];

            for (const key of keys) {
                this._fastify.get(
                    path + '/:id/' + key,
                    {},
                    this.routeHandler('routeSub', key)
                );
            }
        }
    }

    _populateSchema(funcName: TFMASchemaVerbs, optSchema: TFMASchema) {
        if (optSchema === undefined) return {};
        // get default schema for funcName and merge with optSchema
        // merge response separately
        return {
            schema: {
                ...this._defaultSchemas[funcName],
                ...optSchema,
                response: {
                    ...this._defaultSchemas[funcName]!.response,
                    ...(optSchema.response || {})
                }
            }
        };
    }

    routeHandler(funcName: Exclude<TFMASchemaVerbs, "routeSub">, subRouteName: TFMAModelMethodsKeys | null = null) {
        return async (request: FastifyGenRequest, reply: FastifyGenReply) => {
            if (typeof this._checkAuth === 'function') {
                await this._checkAuth(request, reply);
            }
            if (subRouteName) {
                return await this.routeSub(subRouteName, request as FastifyIdRequest, reply);
            } else {
                if (funcName === 'routeList') {
                    return await this[funcName](request, reply);
                } else {
                    return await this[funcName](request as FastifyIdRequest, reply);
                }
            }
        };
    }

    async routeSub(routeName: TFMAModelMethodsKeys, request:FastifyIdRequest, reply: FastifyGenReply) {
        let id = request.params.id || null;
        let doc = null;
        try {
            doc = await this._model.findById!(id).exec();
        } catch (e) {
            doc = null;
        }

        if (!doc) {
            reply.callNotFound();
        } else {
            let data = this._apiSubRoutesFunctions[routeName](doc);
            let ret = null;

            if (
                Object.getPrototypeOf(data) &&
                Object.getPrototypeOf(data).constructor.name == 'Query'
            ) {
                ret = await this.getListResponse(data, request, reply);
            } else {
                data = await Promise.resolve(data);
                if (Array.isArray(data)) {
                    ret = {};

                    ret.items = await this.arrayOfDocsToAPIResponse(
                        data,
                        request
                    );
                    ret.total = ret.items.length;
                } else {
                    ret = await this.docToAPIResponse(data, request);
                }
            }

            reply.send(ret);
        }
    }

    async getListResponse(query: QueryList, request: FastifyIdRequest) {
        let offset = request.query.offset
            ? parseInt(request.query.offset, 10)
            : 0;
        let limit = request.query.limit
            ? parseInt(request.query.limit, 10)
            : 100;
        let sort = request.query.sort ? request.query.sort : null;
        let filter = request.query.filter ? request.query.filter : null;
        let where = request.query.where ? request.query.where : null;
        let search = request.query.search ? request.query.search : null;
        let match = request.query.match ? request.query.match : null;
        let fields = request.query.fields ? request.query.fields : null;

        let populate = request.query['populate[]']
            ? request.query['populate[]']
            : request.query.populate
                ? request.query.populate
                : null;

        let ret = {};

        if (search) {
            query = query.and([{ $text: { $search: search } }]);
        }

        if (filter) {
            const filterParsed = ('' + filter).split('=');
            const splet = filterParsed as [string, string | boolean];
            if (splet.length < 2) {
                splet[1] = true; /// default value
            }

            query.where(splet[0]).equals(splet[1]);
        }

        if (where) {
            const allowedMethods = [
                '$eq',
                '$gt',
                '$gte',
                '$in',
                '$lt',
                '$lte',
                '$ne',
                '$nin',
                '$and',
                '$not',
                '$nor',
                '$or',
                '$exists',
                '$regex',
                '$options'
            ] as QuerySelector[];
            const sanitize = function (v: QueryFilter|Array<QueryFilter>) {
                if (v instanceof Object) {
                    for (const key in v) {
                        if (
                            /^\$/.test(key) &&
                            allowedMethods.indexOf(key as QuerySelector) === -1
                        ) {
                            throw new Error('Invalid where method: ' + key);
                        } else {
                            sanitize(v[key]);
                        }
                    }
                }
                return v;
            };

            const whereAsObject = sanitize(JSON.parse(where)) as unknown as Array<QueryFilter>;

            query.and(whereAsObject);
        }

        if (match) {
            let splet = ('' + match).split('=');
            if (splet.length == 2) {
                const matchOptions: Array<QueryFilter> = [] ;
                splet[0] && splet[1] && (matchOptions.push({[splet[0]]: { $regex: splet[1] }}));
                query = query.and(matchOptions);
            }
        }

        if (this._model.onListQuery) {
            await this._model.onListQuery(query, request);
        }

        if (query.clone) {
            // mongoose > 6.0
            ret.total = await query.clone().countDocuments(); /// @todo Use estimatedDocumentCount() if there're no filters?
        } else {
            ret.total = await query.countDocuments(); /// @todo Use estimatedDocumentCount() if there're no filters?
        }

        query.limit(limit);
        query.skip(offset);

        if (populate) {
            if (Array.isArray(populate)) {
                for (let pop of populate) {
                    query.populate(pop);
                }
            } else {
                query.populate(populate);
            }
        }

        if (sort) {
            query.sort(sort);
        }

        if (fields) {
            query.select(fields.split(','));
        }

        let docs = await query.find().exec();
        ret.items = await this.arrayOfDocsToAPIResponse(docs, request);

        return ret;
    }

    async routeList(request: FastifyGenRequest, reply: FastifyGenReply) {
        let query = this._model.find();
        reply.send(await this.getListResponse(query, request, reply));
    }

    async populateIfNeeded(request, doc) {
        let populate = request.query['populate[]']
            ? request.query['populate[]']
            : request.query.populate
                ? request.query.populate
                : null;
        if (populate) {
            let populated = null;
            if (Array.isArray(populate)) {
                populated = doc.populate(populate);
                // for (let pop of populate) {
                // 	doc.populate(pop);
                // }
            } else {
                populated = doc.populate(populate);
            }

            if (populated.execPopulate) {
                await populated.execPopulate();
            } else {
                await populated;
            }

            // await doc.execPopulate();
        }
    }

    async routePost(request:FastifyIdRequest, reply: FastifyGenReply) {
        let doc = await this._model.apiPost(request.body, request);
        await this.populateIfNeeded(request, doc);

        reply.send(await this.docToAPIResponse(doc, request));
    }

    async routeGet(request: FastifyIdRequest, reply: FastifyGenReply) {
        let id = request.params.id || null;

        let doc = null;
        try {
            doc = await this._model.findById(id).exec();
        } catch (e) {
            doc = null;
        }

        if (!doc) {
            reply.callNotFound();
        } else {
            await this.populateIfNeeded(request, doc);
            let ret = await this.docToAPIResponse(doc, request);
            reply.send(ret);
        }
    }

    async routePut(request: FastifyIdRequest, reply: FastifyGenReply) {
        let id = request.params.id || null;

        let doc = null;
        try {
            doc = await this._model.findById(id).exec();
        } catch (e) {
            doc = null;
        }

        if (!doc) {
            reply.callNotFound();
        } else {
            await doc.apiPut(request.body, request);
            await this.populateIfNeeded(request, doc);
            let ret = await this.docToAPIResponse(doc, request);
            reply.send(ret);
        }
    }

    async routePatch(request: FastifyIdRequest, reply: FastifyGenReply) {
        await this.routePut(request, reply);
    }

    async routeDelete(request:FastifyIdRequest, reply: FastifyGenReply) {
        let id = request.params.id || null;
        let doc = null;
        try {
            doc = await this._model.findById(id).exec();
        } catch (e) {
            doc = null;
        }

        if (!doc) {
            reply.callNotFound();
        } else {
            await doc.apiDelete(request);
            reply.send({ success: true });
        }
    }

    async arrayOfDocsToAPIResponse(docs, request) {
        const fn = doc => this.docToAPIResponse(doc, request);
        const promises = docs.map(fn);
        return await Promise.all(promises);
    }

    async docToAPIResponse(doc, request) {
        return doc ? (doc.apiValues ? doc.apiValues(request) : doc) : null;
    }
}

export default APIRouter;
