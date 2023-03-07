const debug = require('debug')('fastify-mongoose-api');

class APIRouter {
	constructor(params = {}) {
		this._models = params.models || [];
		this._fastify = params.fastify || null;
		this._model = params.model || null;
		this._checkAuth = params.checkAuth || null;

		this._modelName = this._model.modelName;

		this._prefix = params.prefix || '/api/';

		this._collectionName = this._model.prototype.collection.name;

		this._path = this._prefix + this._collectionName;

		this._apiSubRoutesFunctions = {};
		this.setUpRoutes();
	}

	get collectionName() {
		return this._collectionName;
	}

	get path() {
		return this._path;
	}

	setUpRoutes() {
		let path = this._path;
		this._fastify.get(path, {}, this.routeHandler('routeList'));
		this._fastify.post(path, {}, this.routeHandler('routePost'));
		this._fastify.get(path+'/:id', {}, this.routeHandler('routeGet'));
		this._fastify.put(path+'/:id', {}, this.routeHandler('routePut'));
		this._fastify.patch(path+'/:id', {}, this.routeHandler('routePut'));
		this._fastify.delete(path+'/:id', {}, this.routeHandler('routeDelete'));

		/// check if there's apiSubRoutes method on the model
		if (this._model['apiSubRoutes']) {
			this._apiSubRoutesFunctions = this._model['apiSubRoutes']();

			for (let key of Object.keys(this._apiSubRoutesFunctions)) {
				this._fastify.get(path+'/:id/'+key, {}, this.routeHandler('routeSub', key));
			}
		}

		debug('set up API path', path, 'sub routes: ', Object.keys(this._apiSubRoutesFunctions));
	}

	routeHandler(funcName, subRouteName = null) {
		return async (request, reply) => {
				if (typeof(this._checkAuth) === 'function') {
					await this._checkAuth(request, reply);
				}
				if (subRouteName) {
					return await this.routeSub(subRouteName, request, reply);
				} else {
					return await this[funcName](request, reply);
				}
			}
	}

	async routeSub(routeName, request, reply) {
		let id = request.params.id || null;
		let doc = null;
		try {
			doc = await this._model.findById(id).exec();
		} catch(e) {
			doc = null;
		}

		if (!doc) {
			reply.callNotFound();
		} else {
			let data = this._apiSubRoutesFunctions[routeName](doc);
			let ret = null;

			if (Object.getPrototypeOf(data) && Object.getPrototypeOf(data).constructor.name == 'Query') {
				ret = await this.getListResponse(data, request, reply);
			} else {
				data = await Promise.resolve(data);
				if (Array.isArray(data)) {
					ret = {};

					ret.items = await this.arrayOfDocsToAPIResponse(data, request);
					ret.total = ret.items.length;
				} else {
					ret = await this.docToAPIResponse(data, request);
				}
			}

			reply.send(ret);
		}
	}

	async getListResponse(query, request) {
		let offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;
		let limit = request.query.limit ? parseInt(request.query.limit, 10) : 100;
		let sort = request.query.sort ? request.query.sort : null;
		let filter = request.query.filter ? request.query.filter : null;
		let where = request.query.where ? request.query.where : null;
		let search = request.query.search ? request.query.search : null;
		let match = request.query.match ? request.query.match : null;
		let fields = request.query.fields ? request.query.fields : null;

		let populate = request.query['populate[]'] ? request.query['populate[]'] : (request.query.populate ? request.query.populate : null);

		let ret = {};

		if (search) {
			query = query.and({$text: {$search: search}});
		}

		if (filter) {
			let splet = (''+filter).split('=');
			if (splet.length < 2) {
				splet[1] = true; /// default value
			}

			query.where(splet[0]).equals(splet[1]);
		}

		if (where) {

			const allowedMethods = ['$eq', '$gt', '$gte', '$in', '$lt', '$lte', '$ne', '$nin', '$and', '$not', '$nor', '$or', '$exists'];
			const sanitize = function(v) {
				if (v instanceof Object) {
					for (var key in v) {
						if (/^\$/.test(key) && allowedMethods.indexOf(key) === -1) {
							delete v[key];
						} else {
							sanitize(v[key]);
						}
					}
				}
				return v;
			};

			const whereAsObject = sanitize(JSON.parse(where));

			query.and(whereAsObject);
		}

		if (match) {
			let splet = (''+match).split('=');
			if (splet.length == 2) {
				const matchOptions = {};
				matchOptions[splet[0]] = {$regex: splet[1]};
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

	async routeList(request, reply) {
		let query = this._model.find();
		reply.send(await this.getListResponse(query, request, reply));
	}

	async populateIfNeeded(request, doc) {
		let populate = request.query['populate[]'] ? request.query['populate[]'] : (request.query.populate ? request.query.populate : null);
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

	async routePost(request, reply) {
		let doc = await this._model.apiPost(request.body, request);
		await this.populateIfNeeded(request, doc);

		reply.send(await this.docToAPIResponse(doc, request));
	}

	async routeGet(request, reply) {
		let id = request.params.id || null;

		let doc = null;
		try {
			doc = await this._model.findById(id).exec();
		} catch(e) {
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

	async routePut(request, reply) {
		let id = request.params.id || null;

		let doc = null;
		try {
			doc = await this._model.findById(id).exec();
		} catch(e) {
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

	async routeDelete(request, reply) {
		let id = request.params.id || null;
		let doc = null;
		try {
			doc = await this._model.findById(id).exec();
		} catch(e) {
			doc = null;
		}

		if (!doc) {
			reply.callNotFound();
		} else {
			await doc.apiDelete(request);
			reply.send({success: true});
		}
	}

	async arrayOfDocsToAPIResponse(docs, request) {
		const fn = (doc) => this.docToAPIResponse(doc,request);
		const promises = docs.map(fn);
		return await Promise.all(promises);
	}

	async docToAPIResponse(doc, request) {
		return doc ? ( doc.apiValues ? doc.apiValues(request) : doc ) : null;
	}
}

module.exports = APIRouter;