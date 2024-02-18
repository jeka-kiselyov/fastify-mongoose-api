class DefaultModelMethods {
    /**
     * [apiSubRoutes description]
     * @return {[type]} [description]
     */
    static apiSubRoutes() {
        /// this points to model (schema.statics.)
        const subRoutes = {};

        const fPopulated = pathname => {
            return async doc => {
                const populate = doc.populate(pathname);
                if (populate.execPopulate) {
                    await populate.execPopulate();
                } else {
                    await populate;
                }

                // await doc.populate(pathname).execPopulate();
                return doc[pathname];
            };
        };

        const fExternal = (externalModel, refKey) => {
            return doc => {
                const whereOptions = {};
                whereOptions[refKey] = doc;

                return externalModel.find().where(whereOptions);
            };
        };

        this.schema.eachPath((pathname, schematype) => {
            if (
                schematype &&
                schematype.instance &&
                schematype.instance.toLowerCase() == 'objectid' &&
                schematype.options &&
                schematype.options.ref
            ) {
                /// there is Ref ObjectId in this model
                subRoutes[pathname] = fPopulated(pathname);
            }
        });

        for (const key of Object.keys(this.db.models)) {
            const model = this.db.models[key];
            model.schema.eachPath((refKey, schematype) => {
                if (
                    schematype &&
                    schematype.instance &&
                    schematype.instance.toLowerCase() == 'objectid' &&
                    schematype.options &&
                    schematype.options.ref &&
                    schematype.options.ref == this.modelName
                ) {
                    //// there is Ref to this model in other model
                    let pathname = model.prototype.collection.name;
                    if (!subRoutes[pathname]) {
                        /// set up route as default name, /author/ID/books
                        subRoutes[pathname] = fExternal(model, refKey);
                    } else {
                        /// if there're few refs to same model, as Author and co-Author in book, set up additional routes
                        /// as /author/ID/books_as_coauthor
                        /// keeping the first default one
                        pathname += '_as_' + refKey;
                        subRoutes[pathname] = fExternal(model, refKey);
                    }
                } else if (
                    schematype &&
                    schematype.instance == 'Array' &&
                    schematype.options &&
                    schematype.options.type &&
                    schematype.options.type[0] &&
                    schematype.options.type[0].ref == this.modelName
                ) {
                    //// Refs as the array of ObjectId
                    //// like:
                    ////  inspired: [{ type : mongoose.Schema.Types.ObjectId, ref: 'Book' }],
                    //// there is Ref to this model in other model
                    let pathname = model.prototype.collection.name;
                    if (!subRoutes[pathname]) {
                        /// set up route as default name, /author/ID/books
                        subRoutes[pathname] = fExternal(model, refKey);
                    } else {
                        /// if there're few refs to same model, as Author and co-Author in book, set up additional routes
                        /// as /author/ID/books_as_coauthor
                        /// keeping the first default one
                        pathname += '_as_' + refKey;
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
        const doc = new this();

        this.schema.eachPath(pathname => {
            if (data[pathname] !== undefined) {
                if (pathname.includes('.')) {
                    // nested document
                    const keys = pathname.split('.');
                    const lastKey = keys.pop();
                    const lastObj = keys.reduce(
                        (doc, key) => (doc[key] = doc[key] || {}),
                        doc
                    );
                    lastObj[lastKey] = data[pathname];
                } else {
                    doc[pathname] = data[pathname];
                }
            }
        });

        await doc.save();
        return doc;
    }

    /**
     * [apiValues description]
     * @return {[type]} [description]
     */
    async apiValues(request) {
        // complex logic below is to be sure deeper populated object are covered by their .apiValues()
        // method.
        // If you don't need this, just use simple:
        // return this.toObject({depopulate: true});
        // instead
        // But please be sure you understand it doesn't proceed populated documents with apiValues() and
        // you may end showing off data you wanted to keep private.

        let areThereDeepObjects = false;
        const deepObjectsPromisesArray = [];
        const deepObjectsPromisesResults = {};

        let versionKey = true;
        if (this.__api && this.__api._exposeVersionKey === false) {
            versionKey = false;
        }

        let modelNameField = null;
        if (this.__api && this.__api._exposeModelName) {
            if (typeof this.__api._exposeModelName == 'string') {
                modelNameField = this.__api._exposeModelName;
            } else {
                modelNameField = '__modelName';
            }
        }

        // 2 steps
        // 1 - run regular toObject processing and check if there're deeper documents we may need to transform
        // 2 - run toObject processing updaing deeper objects with their .apiValues() results

        const transform = (doc, ret) => {
            if (doc === this) {
                if (modelNameField) {
                    ret[modelNameField] = doc.constructor.modelName;
                }
                return ret;
            } else {
                areThereDeepObjects = true;

                const deeperApiValues = doc.apiValues(request);
                if (typeof deeperApiValues?.then === 'function') {
                    deepObjectsPromisesArray.push(
                        deeperApiValues.then(res => {
                            if (modelNameField) {
                                res[modelNameField] = doc.constructor.modelName;
                            }
                            deepObjectsPromisesResults[doc.id] = res;
                        })
                    );
                } else {
                    if (modelNameField) {
                        deeperApiValues[modelNameField] =
                            doc.constructor.modelName;
                    }
                    deepObjectsPromisesResults[doc.id] = deeperApiValues;
                }
                return null; // to be covered later
            }
        };

        const firstResult = this.toObject({
            transform: transform,
            versionKey: versionKey
        });

        if (!areThereDeepObjects) {
            // return data after 1st step if there's nothing deeper
            return firstResult;
        }

        // await for promises, if any
        await Promise.all(deepObjectsPromisesArray);

        const transformDeeper = (doc, ret) => {
            if (doc === this) {
                if (modelNameField) {
                    ret[modelNameField] = doc.constructor.modelName;
                }
                return ret;
            } else {
                return deepObjectsPromisesResults[doc.id];
            }
        };

        return this.toObject({
            transform: transformDeeper,
            versionKey: versionKey
        });
    }

    /**
     * [apiPut description]
     * @param  Object data [description]
     * @return Document      [description]
     */
    async apiPut(data) {
        //// this points to document (schema.methods.)
        this.schema.eachPath(pathname => {
            let newValue = undefined;
            let isChanged = false;
            if (data[pathname] !== undefined) {
                newValue = data[pathname];
                isChanged = true;
            } else if (data[pathname] === null) {
                newValue = undefined;
                isChanged = true;
            }
            if (isChanged) {
                if (pathname.includes('.')) {
                    const doc = this;
                    // nested document
                    const keys = pathname.split('.');
                    const lastKey = keys.pop();
                    const lastObj = keys.reduce(
                        (doc, key) => (doc[key] = doc[key] || {}),
                        doc
                    );
                    lastObj[lastKey] = newValue;
                } else {
                    this[pathname] = newValue;
                }
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
        await this.deleteOne();
    }
}

export default DefaultModelMethods;
