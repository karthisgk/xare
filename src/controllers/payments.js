const common = require('../js/common.js');
const config = require('../config/index.js');
const GroupsModel = require('../models/groups');
const UserModel = require('../models/users');

function PaymentController() {
	
}

PaymentController.prototype.make = (req, res) => {
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

	const reqBody = common.getPassFields(['name', 'description'], req.body);
	if( req.body.members.indexOf(req.accessUser._id) == -1 )
		req.body.members.push(req.accessUser._id);

	config.db.get('payments', {groupId: req.body.groupId}, groups => {

		var members = [];
		req.body.members.forEach((member, ind) => {
			var obj = {
				memberId: member,
				amountToBePay: parseInt(req.body.amount) / req.body.members.length,
				status: 'pending'
			};
			obj.amountToBePay = parseFloat(obj.amountToBePay).toFixed(2);
			members.push(obj);
		});
		var dbData = {
			_id: common.getMongoObjectId(),
			...reqBody,
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

PaymentController.prototype.raiseObjection = (req, res) => {
	if(!req.hasOwnProperty('accessToken') ||
		!req.hasOwnProperty('accessUser')){
		res.json(common.getResponses('005', {}));
		return;
	}

	if(!req.body.paymentId){
		res.json(common.getResponses('003', {}));
		return;
	}

	new PaymentController().getData(req.body.paymentId, (payment) => {
		if(payment.length == 0){
			res.json(common.getResponses('003', {}));
			return;
		}
		payment = payment[0];
		var isMember = false;
		payment.members.forEach((member, ind) => {
			if(member.memberId == req.accessUser._id)
				isMember = member;
		});
		if(!isMember){
			res.json(common.getResponses('037', {}));
			return;
		}
		var insertData = {
			_id: common.getMongoObjectId(),
			paymentId: payment._id,
			groupId: payment.groupId,
			userId: req.accessUser._id,
			raisedOn: common.current_time(),
			amount: isMember.amountToBePay,
			satus: 'pending'
		};
		config.db.get('objections', { paymentId: payment._id, userId: req.accessUser._id }, objections => {
			if(objections.length) {
				const objection = objections[0];
				const updateData = {
					raisedOn: insertData.raisedOn, amount: insertData.amount
				}
				config.db.update('objections', {_id: objection._id}, updateData, (err, result) => {
					res.json(common.getResponses('020', {objectionId: objection._id}));
				});
			} else {
				config.db.insert('objections', insertData, (err, result) => {
					res.json(common.getResponses('020', {objectionId: insertData._id}));
				});
			}
		})
	});
};

PaymentController.prototype.acceptObjection = (req, res) => {
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

	var self = new PaymentController();
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
			self.calculateShares(req.body.paymentId, payment);
			res.json(common.getResponses('020', {}));
		});
	});
};

PaymentController.prototype.getData = (paymentId, cb) => {
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

PaymentController.prototype.calculateShares = (paymentId, payment = '') => {

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
					if(objection.userId == userId) {
						rt = objection.userId == userId;
					}
				});
				return rt;
			};
			payment.members.forEach((member, ind) => {
				var objector = isObjector(member.memberId);
				member.amountToBePay = objector ? '0.00' : equalShareAmount;
				member.satus = objector ? 'objection accepted' : member.satus;
				members.push(member);
			});
			config.db.update('payments', {_id: paymentId}, {members: members}, (err, result) => {});
		});
	};


	if(!payment){
		new PaymentController().getData(paymentId, payment => {
			if(payment.length == 0)
				return;
			payment = payment[0];
			calculate(paymentId, payment);
		});
	}else
		calculate(paymentId, payment);
};

PaymentController.prototype.complete = (req, res) => {
	const reqBody = common.getPassFields(['paymentId', 'memberId'], req.body);
	if(!reqBody.paymentId || !reqBody.memberId) {
		res.json(common.getResponses('003', {}));
		return;
	}

	config.db.get('payments', {_id: reqBody.paymentId}, payments => {
		if(payments.length) {
			const payment = payments[0];
			if(payment.spender != req.accessUser._id){
				res.json(common.getResponses('037', {}));
				return;
			}

			const members = [];
			if(payment.members && payment.members.length) {
				payment.members.forEach(m => {
					if(m.memberId == reqBody.memberId){
						m.status = 'paid';
					}
					members.push(m);
				})
			}
			config.db.update('payments', {_id: reqBody.paymentId}, { members }, (err, result) => {
				res.json( common.getResponses('020', {result} ));
			});
		} else {
			res.json(common.getResponses('003', { e: 'payment not found'}));
		}
	});
}

PaymentController.prototype.getPayments = (req, res) => {

	if(!req.hasOwnProperty('accessToken') ||
		!req.hasOwnProperty('accessUser')){
		res.json(common.getResponses('005', {}));
		return;
	}

	var lookups = [];
	var matchAnd = [];
	var mergeObjects = ["$$ROOT"];
	lookups.push({
		$lookup: {
			from: 'groups',
			localField: 'groupId',
			foreignField: '_id',
			as: 'group'
		}
	});
	mergeObjects.push({group: { $arrayElemAt: [ "$group", 0 ] }});
	lookups.push({
		$replaceRoot: {
	        newRoot: {
	            $mergeObjects: mergeObjects
	        }
	    }
    });
	if(req.body.groupId) {
		matchAnd.push({groupId: req.body.groupId});
	}
	matchAnd.push( {membersArray: {$all: [req.accessUser._id]}} );
	lookups.push({ $match: {$and: matchAnd} });
	lookups.push({ $sort : {createdAt: -1} });
	if(typeof req.body.offset != 'undefined') {
		var lmt = typeof req.body.limit == 'undefined' ? 10 : parseInt(req.body.limit);
		lmt = parseInt(req.body.offset) + lmt;
		lookups.push({ $limit: parseInt(lmt)});
		lookups.push({ $skip: parseInt(req.body.offset)});
	}
	config.db.customGetData('payments', lookups, (err, payments) => {
		var rt = [];
		payments.forEach((payment, ind) => {
			payment.isSpender = false;
			if(payment.spender == req.accessUser._id){
				payment.isSpender = true;
				rt.push(payment);
			}
			else {
				payment.members.forEach((member, ind) => {
					if(member.memberId == req.accessUser._id){
						if(member.status == 'pending')
							payment.amountToBePay = member.amountToBePay;
						rt.push(payment);
					}
				});
			}
		});
		res.json(common.getResponses('020', rt));
	});

};

PaymentController.prototype.getPaymentMembers = (req, res) => {
	if(!req.body.paymentId) {
		res.json(common.getResponses('003', {}));
		return;
	}
	
	
	const paymentId = req.body.paymentId;
	config.db.get('payments', {_id: paymentId}, payments => {
		if(payments.length) {
			const data = payments[0];
			const findMember = function(_id){
				var rt = {};
				data.members.forEach(member => {
					if(_id == member.memberId) {
						rt = member;
					}
				});
				return rt;
			}
			if(data.membersArray.indexOf(req.accessUser._id) == -1){
				res.json(common.getResponses('037', {}));
				return;
			}
	
			const reqBody = common.getPassFields(['limit','offset'])
			const userDoc = new UserModel({});
			userDoc.getData({
				...reqBody,
				condition: [
					{_id: {$in: data.membersArray} }
				]
			}, (err, users) => {
				const rtrn = [];
				users.forEach(user => {
					const memberData = findMember(user._id);
					user.displayName = user.fullName = user.firstName + (user.lastName ? (' ' + user.lastName) : '');
					user.avatar = config.liveUrl + 'storage/avatars/' + (user.avatar ? user.avatar : 'Avatar.jpg');
					rtrn.push({...user, ...memberData});
				})
				res.json(common.getResponses('020', rtrn));
			});
		} else {
			res.json(common.getResponses('003', {}));
		}
	});
}

PaymentController.prototype.getObjections = (req, res) => {
	var lookups = [
		{
			$lookup: {
				from: 'groups',
				localField: 'groupId',
				foreignField: '_id',
				as: 'group'
			}
		},
		{
			$lookup: {
				from: 'payments',
				localField: 'paymentId',
				foreignField: '_id',
				as: 'payment'
			}
		},
		{
			$lookup: {
				from: 'users',
				localField: 'userId',
				foreignField: '_id',
				as: 'user'
			}
		}
	];
	var matchAnd = [];
	var mergeObjects = ["$$ROOT"];
	mergeObjects.push({group: { $arrayElemAt: [ "$group", 0 ] }});
	mergeObjects.push({payment: { $arrayElemAt: [ "$payment", 0 ] }});
	mergeObjects.push({user: { $arrayElemAt: [ "$user", 0 ] }});
	lookups.push({
		$replaceRoot: {
	        newRoot: {
	            $mergeObjects: mergeObjects
	        }
	    }
    });
	if(req.body.groupId) {
		matchAnd.push({groupId: req.body.groupId});
	}
	if(req.body.paymentId) {
		matchAnd.push({paymentId: req.body.paymentId});
	}
	if(req.body.status && req.body.status != 'all') {
		matchAnd.push({satus: req.body.status});
	}
	matchAnd.push( {"payment.membersArray": {$all: [req.accessUser._id]}} );
	if(req.body.objectionRequest)
		matchAnd.push( {"payment.spender": req.accessUser._id} );
	else
		matchAnd.push( {userId: req.accessUser._id} );
	lookups.push( { $project: {"user.accessToken" : 0, "user.otp": 0, "user.otpExpiriesIn": 0} });
	lookups.push({ $match: {$and: matchAnd} });
	lookups.push({ $sort : {raisedOn: -1} });
	if(typeof req.body.offset != 'undefined') {
		var lmt = typeof req.body.limit == 'undefined' ? 10 : parseInt(req.body.limit);
		lmt = parseInt(req.body.offset) + lmt;
		lookups.push({ $limit: parseInt(lmt)});
		lookups.push({ $skip: parseInt(req.body.offset)});
	}
	config.db.customGetData('objections', lookups, (err, objections) => {
		const rtrn = [];
		objections.forEach(objection => {
			const { user, payment } = objection;
			const findMember = function(_id){
				var rt = {};
				payment.members.forEach(member => {
					if(_id == member.memberId) {
						rt = member;
					}
				});
				return rt;
			}
			const memberData = findMember(user._id);
			user.displayName = user.fullName = user.firstName + (user.lastName ? (' ' + user.lastName) : '');
			user.avatar = config.liveUrl + 'storage/avatars/' + (user.avatar ? user.avatar : 'Avatar.jpg');
			objection.user = {...user, ...memberData};
			objection.amount = objection.satus == 'accepted' ? '0.00' : objection.amount;
			rtrn.push(objection);
		});
		res.json(common.getResponses('020', rtrn));
	});
}


module.exports = PaymentController;