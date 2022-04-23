const mongoose = require('mongoose');

class BackwardWrapper {
	static async createConnection(MONGODB_URL) {
		const createConn = mongoose.createConnection(MONGODB_URL, { useNewUrlParser: true });
		if (createConn.asPromise) {
			return await createConn.asPromise();
		} else {
			return await createConn;
		}

		// return await mongoose.createConnection(MONGODB_URL, { useNewUrlParser: true }).asPromise();
	}

	static async populateDoc(populated) {
		if (populated.execPopulate) {
			return await populated.execPopulate();
		} else {
			return await populated;
		}
	}
}

module.exports = BackwardWrapper;