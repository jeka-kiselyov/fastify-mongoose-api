class DefaultModelMethods {
    /**
     * [apiSubRoutes description]
     * @return {[type]} [description]
     */
    static apiSubRoutes() {
        /// this points to model (schema.statics.)
        const subRoutes = {};

        let fPopulated = pathname => {
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

        let fExternal = (externalModel, refKey) => {
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

        for (let key of Object.keys(this.db.models)) {
            let model = this.db.models[key];
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
        let doc = new this();

        doc = assignDataToDocPostForReplace(this.schema, doc, data);

        await doc.save();
        return doc;
    }

    /**
     * [apiCoU description]
     * @param  Object data [description]
     * @return Document      [description]
     */
    static async apiCoU(data) {
        /// this points to model (schema.statics.)
        let doc = new this();

        doc = assignDataToDocForUpdate(doc, data);
        await doc.validate();

        // in save-mode, a field set to null is deleted, in update mode, it requires to use $unset
        // so we need to delete it from doc._doc and add it to $unset
        const keysToDelete = Object.keys(data).filter(key => doc[key] === null);
        keysToDelete.forEach(key => delete doc._doc[key]);

        doc = await this.findByIdAndUpdate(
            doc._id,
            {
                $set: doc,
                $unset: Object.fromEntries(keysToDelete.map(key => [key, '']))
            },
            {
                upsert: true,
                new: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        return doc;
    }

    /**
     * [apiCoR description]
     * @param  Object data [description]
     * @return Document      [description]
     */
    static async apiCoR(data) {
        /// this points to model (schema.statics.)
        let doc = new this();

        doc = assignDataToDocPostForReplace(this.schema, doc, data);
        await doc.validate();
        doc = await this.findOneAndReplace({ _id: doc._id }, doc, {
            upsert: true,
            new: true,
            runValidators: true,
            setDefaultsOnInsert: true
        });

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
        let deepObjectsPromisesArray = [];
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
        const model = assignDataToDocForUpdate(this, data);
        await model.save();
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

/**
 * Assigns values from data to doc based on schema paths, handling nested paths.
 * @param {Schema} schema - Mongoose schema object
 * @param {Object} doc - Document to assign values to
 * @param {Object} data - Source data object
 */
const assignDataToDocPostForReplace = (schema, doc, data) => {
    schema.eachPath(pathname => {
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
    return doc;
};

const assignDataToDocForUpdate = (model, data) => {
    model.schema.eachPath(pathname => {
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
                let doc = model;
                // nested document
                const keys = pathname.split('.');
                const lastKey = keys.pop();
                const lastObj = keys.reduce(
                    (doc, key) => (doc[key] = doc[key] || {}),
                    doc
                );
                lastObj[lastKey] = newValue;
            } else {
                model[pathname] = newValue;
            }
        }
    });
    return model;
};
module.exports = DefaultModelMethods;
