const mongoose = require('mongoose');
const util = require('../js/common');
const collectionName = 'groups';
const groupSchema = new mongoose.Schema({
	_id: { type: String, default: util.getMongoObjectId },
    name: String,
    icon: { type: String, default: 'default.png' },
    members: { type: Array, default: [] },
    admins: { type: Array, default: [] },
    createdBy: String,
    createdAt: { 
        date: { type: Date, default: Date.now },
        dateTime: { type: String, default: util.current_time },
        timeStamp: { type: Number, default: new Date().getTime() }
    }
});

groupSchema.methods.getData = function(criteria = {}, cb) {
    var lookups = criteria.lookups && criteria.lookups.length ? criteria.lookups : [];
    if(criteria.condition && criteria.condition.length) {
        lookups.push({ $match: { $and: criteria.condition } });
    }
    lookups.push(util.userProjection);
    if(criteria.offset) {
		var lmt = typeof criteria.limit == 'undefined' ? 10 : parseInt(criteria.limit);
		lmt = parseInt(criteria.offset) + lmt;
		lookups.push({ $limit: parseInt(lmt)});
		lookups.push({ $skip: parseInt(criteria.offset)});
	}
    return this.model(collectionName).aggregate(lookups, cb);   
};

groupSchema.methods.getById = function(cb) {
    return this.model(collectionName).findById(this._id, cb);
}

module.exports = mongoose.model(collectionName, groupSchema);