const APIRouter = require('./APIRouter.js');
const DefaultModelMethods = require('./DefaultModelMethods.js');

class API {
	constructor(params = {}) {
		this._models = params.models || null;
		this._fastify = params.fastify || null;

		this._checkAuth = params.checkAuth || null;
		this._defaultModelMethods = params.defaultModelMethods || DefaultModelMethods;

		this._apiRouters = {};

		// this.setUpServer();
		if (this._models) {
			for (let key of Object.keys(this._models)) {
				this.addModel(this._models[key], params);
			}			
		} else {
			this._models = [];
		}
	}

	get apiRouters() {
		return this._apiRouters;
	}

	addModel(model, params = {}) {
		let setDefaults = true;
		if (params.setDefaults === false) {
			setDefaults = false;
		}

		let methods = params.methods ? params.methods : null;
		let checkAuth = params.checkAuth ? params.checkAuth : null;

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
					methods: methods,
					checkAuth: checkAuth,
					fastify: this._fastify
				});
			}
		}


	}

	decorateModelWithDefaultAPIMethods(model) {
		if (model.schema) {
			if (!model.prototype['apiValues']) {
				model.prototype['apiValues'] = this._defaultModelMethods.prototype.apiValues;				
			}
			if (!model.prototype['apiPut']) {
				model.prototype['apiPut'] = this._defaultModelMethods.prototype.apiPut;				
			}
			if (!model.prototype['apiDelete']) {
				model.prototype['apiDelete'] = this._defaultModelMethods.prototype.apiDelete;				
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