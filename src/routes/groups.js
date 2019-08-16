var common = require('../js/common.js');
var config = require('../config/index.js');

function Groups() {

}

Groups.prototype.index = (req, res) => {
	if(!req.hasOwnProperty('accessToken') ||
		!req.hasOwnProperty('accessUser')){
		res.json(common.getResponses('005', {}));
		return;
	}

	if(!req.body.groupId && !req.body.name){
		res.json(common.getResponses('003', {}));
		return;
	}

	var dbData = {};
	if(req.body.name)
		dbData.name = req.body.name;	

	var dbAction = function(actionData, cb){
		if(!req.body.groupId){
			actionData.members = [];
			if(req.body.members){
				if(typeof req.body.members.length == 'number')
					actionData.members = req.req.body.members;
			}
			actionData.admins = [req.accessUser._id]
			actionData.createdBy = req.accessUser._id;
			actionData._id = common.getMongoObjectId();
			actionData.createdAt = common.current_time();
			config.db.insert('groups', actionData, (err, result) => {
				cb(actionData._id);
			});
		}
		else{
			var $wh = {_id: req.body.groupId};
			config.db.get('groups', $wh, egroup => {
				if(egroup.length == 0){
					res.json(common.getResponses('003', {}));
					return;
				}
				egroup = egroup[0];
				if(egroup.admins.indexOf(req.accessUser._id) > -1) {
					if(typeof req.body.members == 'object'){
						if(typeof req.body.members.length == 'number')
							actionData.members = egroup.members.concat(req.body.members);
					}

					if(typeof req.body.removeMembers == 'object'){
						if(typeof req.body.removeMembers.length == 'number'){
							actionData.members = egroup.members;
							req.body.removeMembers.forEach((member, ind) => {
								var index = actionData.members.indexOf(member);
								if(index > -1)
									actionData.members.splice(index, 1);
							});
						}						
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
					else if(typeof req.body.admins == 'object'
						&& typeof req.body.admins.length == 'number'){
						actionData.admins = egroup.admins.concat(req.body.admins);
					}

					if(typeof req.body.removeAdmin == 'string'){
						actionData.admins = egroup.admins;
						var index = actionData.admins.indexOf(req.body.removeAdmin);
						if(index > -1)
							actionData.admins.splice(index, 1);
					}
				}
				config.db.update('groups', $wh, actionData, (err, result) => {
					cb(req.body.groupId);
				});
			});
		}
	};

	dbAction(dbData, groupId => {		
		new Groups().uploadIcon(req, res, groupId, iconFileName => {
			config.db.update('groups', {_id: groupId},
			{icon: iconFileName}, (err, result) => {});
		});
		res.json(common.getResponses('020', {}));
	});
};

Groups.prototype.uploadIcon = (req, res, _id, cb) => {
	var iconExt = iconFileName = iconTargetPath = '';
	var iconDir = './src/uploads/groups/';
	if(typeof req.file != 'undefined'){
		if(typeof req.file.path != 'undefined'){
			var removeUpload = function(){
				if (fs.existsSync(req.file.path))
					fs.unlinkSync(req.file.path);
			};
			try {
				if (!fs.existsSync(iconDir))
				    fs.mkdirSync(iconDir);
			} catch (err) {
				removeUpload();
				res.json(common.getResponses('035', {}));
				return;
			}

			if(typeof req.fileError != 'undefined'){
				removeUpload();
				res.json(common.getResponses(req.fileError, {}));
				return;
			}

			var iconExt = path.extname(req.file.path);
			iconFileName = 'dvs_' + _id + iconExt;
			iconTargetPath = iconDir + iconFileName;
			try {
				if (fs.existsSync(iconTargetPath))
					fs.unlinkSync(iconTargetPath);
	       		fs.renameSync(req.file.path, iconTargetPath);
	       		cb(iconFileName);
	       		return; 		
	       	} catch (err) {
	       		res.json(common.getResponses('035', {}));
				return;
	       	}
	    }
	}
	cb(iconFileName);
};

Groups.prototype.getData = (req, res) => {
	if(!req.hasOwnProperty('accessToken') ||
		!req.hasOwnProperty('accessUser')){
		res.json(common.getResponses('005', {}));
		return;
	}

	var lookups = [];
	var matchAnd = [];
	matchAnd.push( {members: {$all: [req.accessUser._id]}} );
	if(typeof req.query.groupId == 'string')
		matchAnd.push({_id: req.query.groupId});

	lookups.push({ $match: {$and: matchAnd} });
	if(req.query.offset) {
		var lmt = typeof req.query.limit == 'undefined' ? 3 : req.query.limit;
		lmt = parseInt(req.query.offset) + lmt;
		lookups.push({ $limit: parseInt(lmt)});
		lookups.push({ $skip: parseInt(req.query.offset)});
	}

	config.db.customGetData('groups', lookups, groups => {
		var rt = groups;
		if(typeof req.query.groupId == 'string' && rt.length == 1){
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