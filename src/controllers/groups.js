const common = require('../js/common.js');
const config = require('../config/index');
const GroupsModel = require('../models/groups');
const { defaultIconName } = require('../js/const');

function Groups() {

}

Groups.prototype.index = (req, res) => {

	if(!req.body.groupId && !req.body.name){
		res.json(common.getResponses('003', {}));
		return;
	}

	var dbData = {};
	if(req.body.name){
		dbData.name = req.body.name;
	}
	if(req.file && req.file.filename) {
		dbData.icon = req.file.filename;
	}

	if(typeof req.body.members == 'string') {
		const members = common.isJson(req.body.members);
		if(req.body.members){
			const userIndex = members.indexOf(req.accessUser._id);
			if(userIndex == -1) {
				members.push(req.accessUser._id);
			}
			req.body.members = members;
		}
	}

	var dbAction = function(actionData, cb){
		if(!req.body.groupId){
			actionData.members = req.body.members && req.body.members.length ? req.body.members : [];
			actionData.admins = [req.accessUser._id]
			actionData.createdBy = req.accessUser._id;
			actionData._id = common.getMongoObjectId();
			const currentTime = common.current_time();
			actionData.createdAt = {
				date: new Date(currentTime),
				dateTime: currentTime,
				timeStamp: new Date(currentTime).getTime()
			};
			const groupDoc = new GroupsModel(actionData);
			const err = groupDoc.validateSync();
			if(err) {
				res.json(common.getResponses('003', {message: 'schema error', error: err}));
				return;
			} 
			groupDoc.save().then((doc) => {
				cb(actionData);
			}).catch(e => {
				res.json(common.getResponses('003', {message: 'schema error', error: e}));
			});
		}
		else{
			var $wh = {_id: req.body.groupId};
			const groupDoc = new GroupsModel({_id: req.body.groupId});
			groupDoc.getById((err, egroup) => {
				if(egroup == null || !egroup || !egroup._id) {
					res.json(common.getResponses('003', {}));
					return;
				}
				if(egroup.admins.indexOf(req.accessUser._id) > -1) {
					actionData.members = req.body.members && req.body.members.length ? req.body.members : egroup.members;
					if(req.body.removeMembers && req.body.removeMembers.length){
						actionData.members = egroup.members;
						req.body.removeMembers.forEach((member, ind) => {
							var index = actionData.members.indexOf(member);
							if(index > -1)
								actionData.members.splice(index, 1);
						});						
					}
					else if(typeof req.body.removeMembers == 'string'){
						actionData.members = egroup.members;
						var index = actionData.members.indexOf(req.body.removeMembers);
						if(index > -1)
							actionData.members.splice(index, 1);
					}

					if(actionData.members && egroup.createdBy){
						if(actionData.members.length == 0)
							actionData.members = [egroup.createdBy];
					}

					if(typeof req.body.admins == 'string'){
						actionData.admins = egroup.admins;
						actionData.admins.push(req.body.admins);
					}
					else if(req.body.admins && req.body.admins.length){
						actionData.admins = egroup.admins.concat(req.body.admins);
					}

					if(typeof req.body.removeAdmin == 'string'){
						actionData.admins = egroup.admins;
						var index = actionData.admins.indexOf(req.body.removeAdmin);
						if(index > -1)
							actionData.admins.splice(index, 1);
					}
					Object.keys(actionData).forEach(key => {
						egroup[key] = actionData[key];
					});
					egroup.save();
					cb(egroup);
				} else {
					Object.keys(actionData).forEach(key => {
						egroup[key] = actionData[key];
					});
					egroup.save();
					cb(egroup);
				}
			});
		}
	};

	dbAction(dbData, group => {
		res.json(common.getResponses('020', group));
	});
};

Groups.prototype.getData = (req, res) => {

	var lookups = [];
	var matchAnd = [];
	matchAnd.push( {members: {$all: [req.accessUser._id]}} );
	if(typeof req.body.groupId == 'string')
		matchAnd.push({_id: req.body.groupId});

	lookups.push({ $match: {$and: matchAnd} });
	if(typeof req.body.offset != 'undefined') {
		var lmt = typeof req.body.limit == 'undefined' ? 10 : parseInt(req.body.limit);
		lmt = parseInt(req.body.offset) + lmt;
		lookups.push({ $limit: parseInt(lmt)});
		lookups.push({ $skip: parseInt(req.body.offset)});
	}

	config.db.customGetData('groups', lookups, (err, groups) => {
		var rt = groups.map(g => {
			return {
				...g,
				icon: config.liveUrl + 'storage/groups/' + (g.icon ? g.icon : defaultIconName)
			}
		})
		if(typeof req.body.groupId == 'string' && rt.length == 1){
			rt = rt[0];		
			config.db.get('payments', {groupId: rt._id}, payments => {
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


		}else
			res.json(common.getResponses('020', rt));
	});
};

module.exports = Groups;