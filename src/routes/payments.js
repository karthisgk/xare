var common = require('../js/common.js');
var config = require('../config/index.js');

function Payments() {
	
}

Payments.prototype.make = (req, res) => {
	if(!req.hasOwnProperty('accessToken') ||
		!req.hasOwnProperty('accessUser')){
		res.json(common.getResponses('005', {}));
		return;
	}

	if(!req.body.groupId ||
		!req.body.amount ||
		typeof req.body.members != 'object'){
		res.json(common.getResponses('003', {}));
		return;
	}

	if( req.body.members.indexOf(req.accessUser._id) == -1 )
		req.body.members.push(req.accessUser._id);

	config.db.get('payments', {groupId: req.body.groupId}, groups => {

		var members = [];
		req.body.members.forEach((member, ind) => {
			var obj = {
				memberId: member,
				amountToBePay: parseInt(req.body.amount) / req.body.members.length
			};
			obj.amountToBePay = parseFloat(obj.amountToBePay).toFixed(2);
			members.push(obj);
		});
		var dbData = {
			_id: common.current_time().split(' ')[0] + '_pay' + (groups.length + 1),
			groupId: req.body.groupId,
			amount: req.body.amount,
			spender: req.accessUser._id,
			members: members,
			membersArray: req.body.members,
			createdAt: common.current_time(),
			satus: 'pending'
		};

		config.db.insert('payments', dbData, (err, result) => {
			dbData.timeStamp = new Date(dbData.createdAt).getTime();
			res.json(common.getResponses('020', dbData));
		});
	});
};

Payments.prototype.raiseObjection = (req, res) => {
	if(!req.hasOwnProperty('accessToken') ||
		!req.hasOwnProperty('accessUser')){
		res.json(common.getResponses('005', {}));
		return;
	}

	if(!req.body.paymentId){
		res.json(common.getResponses('003', {}));
		return;
	}

	new Payments().getData(req.body.paymentId, (payment) => {
		if(payment.length == 0){
			res.json(common.getResponses('003', {}));
			return;
		}
		payment = payment[0];
		var isMember = false;
		payment.members.forEach((member, ind) => {
			if(member.memberId == req.accessUser._id)
				isMember = member.memberId == req.accessUser._id;
		});
		if(!isMember){
			res.json(common.getResponses('037', {}));
			return;
		}
		var insertData = {
			_id: common.getMongoObjectId(),
			paymentId: payment._id,
			userId: req.accessUser._id,
			raisedOn: common.current_time(),
			satus: 'pending'
		};
		config.db.insert('objections', insertData, (err, result) => {
			res.json(common.getResponses('020', {objectionId: insertData._id}));
		});
	});
};

Payments.prototype.acceptObjection = (req, res) => {
	if(!req.hasOwnProperty('accessToken') ||
		!req.hasOwnProperty('accessUser')){
		res.json(common.getResponses('005', {}));
		return;
	}

	if(!req.body.paymentId ||
		!req.body.userId ||
		!req.body.status){
		res.json(common.getResponses('003', {}));
		return;
	}

	var self = new Payments();
	self.getData(req.body.paymentId, (payment) => {
		if(payment.length == 0){
			res.json(common.getResponses('003', {}));
			return;
		}
		payment = payment[0];
		if(payment.spender != req.accessUser._id){
			res.json(common.getResponses('037', {}));
			return;
		}

		var $wh = {paymentId: req.body.paymentId, userId: req.body.userId};
		var satus = req.body.status == 'accept' ? 'accepted' : 'rejected';
		config.db.update('objections', $wh, {satus: satus}, (err, result) => {
			res.json(common.getResponses('020', {}));
			self.calculateShares(req.body.paymentId, payment);
		});
	});
};

Payments.prototype.getData = (paymentId, cb) => {
	var lookups = [];
	var mergeObjects = ["$$ROOT"];
	lookups.push({
		$lookup: {
			from: 'groups',
			localField: 'groupId',
			foreignField: '_id',
			as: 'groups'
		}
	});
	mergeObjects.push({groups: { $arrayElemAt: [ "$groups", 0 ] }});
	lookups.push({
		$replaceRoot: {
	        newRoot: {
	            $mergeObjects: mergeObjects
	        }
	    }
    });
    if(paymentId)
    	lookups.push({ $match: {_id: paymentId} });
	config.db.customGetData('payments', lookups,  (err, data) => {
		cb(data);
	});
};

Payments.prototype.calculateShares = (paymentId, payment = '') => {

	var calculate = (paymentId, payment) => {
		var actualMembersCount = payment.members.length;
		config.db.get('objections', {paymentId: paymentId, satus: 'accepted'}, objections => {
			actualMembersCount = actualMembersCount - objections.length;
			var equalShareAmount = parseInt(payment.amount) / actualMembersCount;
			equalShareAmount = parseFloat(equalShareAmount).toFixed(2);
			var members = [];
			var isObjector = function(userId){
				var rt = false;
				objections.forEach((objection, ind) => {
					rt = objection.userId == userId;
				});
				return rt;
			};
			payment.members.forEach((member, ind) => {
				member.amountToBePay = isObjector(member.memberId) ? '0.00' : equalShareAmount;
				members.push(member);
			});
			config.db.update('payments', {_id: paymentId}, {members: members}, (err, result) => {});
		});
	};


	if(!payment){
		new Payments().getData(paymentId, payment => {
			if(payment.length == 0)
				return;
			payment = payment[0];
			calculate(paymentId, payment);
		});
	}else
		calculate(paymentId, payment);
};

Payments.prototype.getPayments = (req, res) => {

	if(!req.hasOwnProperty('accessToken') ||
		!req.hasOwnProperty('accessUser')){
		res.json(common.getResponses('005', {}));
		return;
	}

	if(!req.body.groupId){
		res.json(common.getResponses('003', {}));
		return;
	}

	const get = (group) => {
		var lookups = [];
		var matchAnd = [];
		matchAnd.push({groupId: group._id});
		matchAnd.push( {membersArray: {$all: [req.accessUser._id]}} );
		lookups.push({ $match: {$and: matchAnd} });
		if(req.body.offset) {
			var lmt = typeof req.body.limit == 'undefined' ? 10 : parseInt(req.body.limit);
			lmt = parseInt(req.body.offset) + lmt;
			lookups.push({ $limit: parseInt(lmt)});
			lookups.push({ $skip: parseInt(req.body.offset)});
		}
		config.db.customGetData('payments', lookups, (err, payments) => {
			var rt = group;
			rt.payments = [];
			rt.isAdmin = rt.admins.indexOf( req.accessUser._id ) > -1;
			payments.forEach((payment, ind) => {
				payment.isSpender = false;
				if(payment.spender == req.accessUser._id){
					payment.isSpender = true;
					rt.payments.push(payment);
				}
				else {
					payment.members.forEach((member, ind) => {
						if(member.memberId == req.accessUser._id){
							payment.amountToBePay = member.amountToBePay;
							rt.payments.push(payment);
						}
					});
				}
			});
			res.json(common.getResponses('020', rt));
		});
	};
	const groupId = req.body.groupId;
	config.db.get('groups', {_id: groupId}, groups => {
		if(groups.length > 0){
			const group = groups[0];
			if(group.members.indexOf(req.accessUser._id) > -1)
				get(group);
			else
				res.json(common.getResponses('037', {}));
		}else
			res.json(common.getResponses('003', {}));
	});

};

module.exports = Payments;