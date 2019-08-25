

class APIRouter {
	constructor(params = {}) {
		this._models = params.models || [];
		this._fastify = params.fastify || null;
		this._model = params.model || null;

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
		this._fastify.get(path, {}, (request, reply)=>{return this.routeList(request, reply)});
		this._fastify.post(path, {}, (request, reply)=>{return this.routePost(request, reply)});
		this._fastify.get(path+'/:id', {}, (request, reply)=>{return this.routeGet(request, reply)});
		this._fastify.put(path+'/:id', {}, (request, reply)=>{return this.routePut(request, reply)});
		this._fastify.patch(path+'/:id', {}, (request, reply)=>{return this.routePut(request, reply)});
		this._fastify.delete(path+'/:id', {}, (request, reply)=>{return this.routeDelete(request, reply)});

		/// check if there's apiSubRoutes method on the model
		if (this._model['apiSubRoutes']) {
			this._apiSubRoutesFunctions = this._model['apiSubRoutes']();

			let makeSubHandler = (routeName) => {
				return (request, reply) => {
						return this.routeSub(routeName, request, reply);
					};
			};

			for (let key of Object.keys(this._apiSubRoutesFunctions)) {
				this._fastify.get(path+'/:id/'+key, {}, makeSubHandler(key));				
			}
		}
	}

	async routeSub(routeName, request, reply) {
		let id = request.params.id || null;
		let doc = null;
		try {
			doc = await this._model.findById(id).exec();
		} catch(e) {}

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

					const promises = data.map(this.docToAPIResponse);
					ret.items = await Promise.all(promises);

					ret.total = ret.items.length;				
				} else {
					ret = await this.docToAPIResponse(data);					
				}
			}

			reply.send(ret);
		}
	}

	async getListResponse(query, request, reply) {
		let offset = request.query.offset ? parseInt(request.query.offset, 10) : 0;
		let limit = request.query.limit ? parseInt(request.query.limit, 10) : 100;
		let sort = request.query.sort ? request.query.sort : null;
		let filter = request.query.filter ? request.query.filter : null;
		let search = request.query.search ? request.query.search : null;

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

		ret.total = await query.countDocuments(); /// @todo Use estimatedDocumentCount() if there're no filters?

		query.limit(limit);
		query.skip(offset);

		if (sort) {
			query.sort(sort);
		}

		let docs = await query.find().exec();

		const promises = docs.map(this.docToAPIResponse);
		ret.items = await Promise.all(promises);

		return ret;
	}

	async routeList(request, reply) {
		let query = this._model.find();
		reply.send(await this.getListResponse(query, request, reply));
	}

	async routePost(request, reply) {
		let doc = await this._model.apiPost(request.body);
		reply.send(await this.docToAPIResponse(doc));
	}

	async routeGet(request, reply) {
		let id = request.params.id || null;
		let doc = null;
		try {
			doc = await this._model.findById(id).exec();
		} catch(e) {}

		if (!doc) {
			reply.callNotFound();
		} else {
			let ret = await this.docToAPIResponse(doc);
			reply.send(ret);			
		}
	}

	async routePut(request, reply) {
		let id = request.params.id || null;
		let doc = null;
		try {
			doc = await this._model.findById(id).exec();
		} catch(e) {}

		if (!doc) {
			reply.callNotFound();
		} else {
			await doc.apiPut(request.body);
			let ret = await this.docToAPIResponse(doc);
			reply.send(ret);		
		}
	}

	async routeDelete(request, reply) {
		let id = request.params.id || null;
		let doc = null;
		try {
			doc = await this._model.findById(id).exec();
		} catch(e) {}

		if (!doc) {
			reply.callNotFound();
		} else {
			await doc.apiDelete();
			reply.send({success: true});		
		}
	}

	async docToAPIResponse(doc) {
		return doc ? ( doc.apiValues ? doc.apiValues() : doc ) : null;
	}
}

module.exports = APIRouter;