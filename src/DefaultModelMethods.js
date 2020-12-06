

class DefaultModelMethods {

	/**
	 * [apiSubRoutes description]
	 * @return {[type]} [description]
	 */
	static apiSubRoutes() {
		/// this points to model (schema.statics.)
		const subRoutes = {};

		let fPopulated = (pathname)=>{
			return async(doc) => {
				await doc.populate(pathname).execPopulate();
				return doc[pathname];
			};
		};

		let fExternal = (externalModel, refKey)=>{
			return (doc) => {
				const whereOptions = {};
				whereOptions[refKey] = doc;

				return externalModel.find().where(whereOptions);
			};
		};

		this.schema.eachPath((pathname, schematype) => {
			if (schematype && schematype.instance == 'ObjectID' && schematype.options && schematype.options.ref) {
				/// there is Ref ObjectId in this model
				subRoutes[pathname] = fPopulated(pathname);
			}
		});


		for (let key of Object.keys(this.db.models)) {
			let model = this.db.models[key];
			model.schema.eachPath((refKey, schematype) => {
				if (schematype && schematype.instance == 'ObjectID' && schematype.options && schematype.options.ref && schematype.options.ref == this.modelName) {
					//// there is Ref to this model in other model
					let pathname = model.prototype.collection.name;
					if (!subRoutes[pathname]) {
						/// set up route as default name, /author/ID/books
						subRoutes[pathname] = fExternal(model, refKey);
					} else {
						/// if there're few refs to same model, as Author and co-Author in book, set up additional routes
						/// as /author/ID/books_as_coauthor
						/// keeping the first default one
						pathname+='_as_'+refKey;
						subRoutes[pathname] = fExternal(model, refKey);
					}
				}
			});
		}

		return subRoutes;
	}

	/**
	 * [apiPost description]
	 * @param  Object data [description]
	 * @return Document      [description]
	 */
	static async apiPost(data) {
		/// this points to model (schema.statics.)
		let doc = new this;

		this.schema.eachPath((pathname) => {
			if (data[pathname]) {
				doc[pathname] = data[pathname];
			}
		});

		await doc.save();
		return doc;
	}

	/**
	 * [apiValues description]
	 * @return {[type]} [description]
	 */
	async apiValues() {
		return this.toObject();
	}

	/**
	 * [apiPut description]
	 * @param  Object data [description]
	 * @return Document      [description]
	 */
	async apiPut(data) {
		//// this points to document (schema.methods.)
		this.schema.eachPath((pathname) => {
			if (data[pathname]) {
				this[pathname] = data[pathname];
			} else if (data[pathname] === null) {
				this[pathname] = undefined;
			}
		});

		await this.save();
	}

	/**
	 * [apiDelete description]
	 * @return Boolean	success
	 */
	async apiDelete() {
		//// this points to document (schema.methods.)
		await this.remove();

	}
}

module.exports = DefaultModelMethods;