var common = require('../js/common.js');
const request = require('request');
var config = require('../config/index.js');
var path = require('path');
const fs = require('fs');
const UserModel = require('../models/users');
const GroupsModel = require('../models/groups');
const { PRODUCTION } = require('../js/const');

function User() {
	var self = this;
	this.auth = function(){
		return function(req, res, next){

			if(req.headers.hasOwnProperty('token')){

				const token = req.headers.token;
				const userDoc = new UserModel({accessToken: [token]});
				userDoc.validateToken((user) => {
					if(user && user._id){
						req.accessToken = token;
						req.accessUser = user;
						next();
					}
					else
						res.json(common.getResponses('005', {}));
				});

			}else
				next();
		};
	};

	this.checkAccess = () => {
		return (req, res, next) => {
			if(!req.hasOwnProperty('accessToken') ||
				!req.hasOwnProperty('accessUser')){
				res.json(common.getResponses('005', {}));
				return;
			}
			next();
		} 
	}
};

User.prototype.getProfile = (req, res) => {
	var user = {...req.accessUser._doc};
	user.displayName = user.fullName = user.firstName + (user.lastName ? (' ' + user.lastName) : '');
	user.avatar = config.liveUrl + 'storage/avatars/' + (user.avatar ? user.avatar : 'Avatar.jpg');
	delete user.accessToken;
	delete user.otp;
	res.json(common.getResponses('020', user));
};

User.prototype.verifyOtp = function(req, res){

	if(!req.body.mobileNumber ||
		!req.body.otp){
		res.json(common.getResponses('003', {}));
		return;
	}
	const userDoc = new UserModel({mobileNumber: req.body.mobileNumber});
	userDoc.findByMobileNumber(matchUser => {
		if(!matchUser) {
			res.json(common.getResponses('004', {}));
		} else {

			if(matchUser.otp != req.body.otp){
				res.json(common.getResponses('044', {}));
				return;
			}

			if(matchUser.otpExpiriesIn < common.current_time()) {
				res.json(common.getResponses('045', {}));
				return;
			}
			const token = common.getCrptoToken(32);
			matchUser.otp = '';
			matchUser.otpExpiriesIn = '';
			matchUser.accessToken.push(token);
			matchUser.save();
			res.json(common.getResponses('020', {accessToken: token}));
		}
	});
};

User.prototype.signIn = function(req, res){

	const reqBody = common.getPassFields(['mobileNumber'], req.body);

	if( !reqBody.mobileNumber ){
		res.json(common.getResponses('003', {}));
		return;
	}

	const sentOtp = (otp, mobileNumber) => {
		if(!PRODUCTION) {
			return;
		}
		var paramData = config.sms_config;
		paramData.phone = mobileNumber;
		paramData.message = 'Your otp is ' + otp;
		var clientServerOptions = {
			uri: 'https://www.sms4india.com/api/v1/sendCampaign',
			body: JSON.stringify(paramData),
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			}
		}
		request(clientServerOptions, function (error, response) {
			console.log(error,response.body);
			return;
		});
	}

	const mobileNumber = reqBody.mobileNumber;
	const otp = PRODUCTION ? common.generateOTP() : '123456';
	const otpExpiriesIn = common.current_time(common.addTime(new Date(), 0, 10));
	const currentTime = common.current_time();
	const userDoc = new UserModel({mobileNumber});
	userDoc.findByMobileNumber(matchUser => {
		if(matchUser && matchUser._id) {
			matchUser.otp = otp;
			matchUser.otpExpiriesIn = otpExpiriesIn;
			matchUser.save();
			sentOtp(otp, mobileNumber);
			res.json(common.getResponses('020', {otpExpiriesIn: new Date(otpExpiriesIn).getTime()}));
		} else {
			const user = new UserModel( {
				_id: common.getMongoObjectId(),
				firstName: '',
				lastName: '',
				emailId: '',
				mobileNumber,
				userType: 'users',
				isActivated: true,
				avatar: '',
				accessToken: [],
				chatConversations: [],
				otp,
				otpExpiriesIn,
				createdAt: {
					date: new Date(currentTime),
					dateTime: currentTime,
					timeStamp: new Date(currentTime).getTime()
				}
			} );
			const err = user.validateSync();
			if(err) {
				res.json(common.getResponses('003', {message: 'schema error', error: err}));
				return;
			} 
			user.save().then((doc) => {
				sentOtp(otp, mobileNumber);
				res.json(common.getResponses('020', {otpExpiriesIn: new Date(otpExpiriesIn).getTime()}));
			}).catch(e => {
				res.json(common.getResponses('003', {message: 'schema error', error: e}));
			});
		}
	});

};

User.prototype.isUserExist = (req, res) => {
	if(!req.body.mobileNumber) {
		res.json(common.getResponses('003', {}));
		return;
	}

	const userDoc = new UserModel({mobileNumber: req.body.mobileNumber});
	userDoc.findByMobileNumber(matchUser => {
		if(matchUser && matchUser._id){
			if(!matchUser.emailId || !matchUser.firstName || !matchUser.avatar) {
				res.json(common.getResponses('046', {}));
			} else {
				res.json(common.getResponses('020', {}));
			}
		}else
			res.json(common.getResponses('043', {}));
	});
};

User.prototype.logOut = function(req, res){

	const accessTokenKey = req.accessUser.accessToken.indexOf(req.accessToken);
	if(accessTokenKey > -1) {
		req.accessUser.accessToken.splice(accessTokenKey, 1);
		req.accessUser.save();
	}
	res.json(common.getResponses('024', {}));

};

User.prototype.verificationMail = function(link, UEmail, subject){	

	config.db.get('settings', {}, (data) => {
		if(data.length > 0){
			data = data[0];
			var content = '<h3>'+data.title+'</h3>';
			content += '<p><a href="'+link+'">click here to do action</a></p>';
			var cfg = config.smtp_config;
			cfg.auth.user = data.smtp_user;
			cfg.auth.pass = data.smtp_password;
			cfg.content = content;
			cfg.subject = subject;
			cfg.to = UEmail;
			common.sendEMail(cfg);
		}
	});

};

User.prototype.updateUser = function(req, res) {
	const passField = ['firstName', 'lastName', 'emailId', 'upiId'];
	const reqBody = common.getPassFields(passField, req.body);
    reqBody.avatar = req.file && req.file.filename ? req.file.filename : req.accessUser.avatar;
    Object.keys(reqBody).forEach(key => {
        req.accessUser[key] = reqBody[key];
    });
    req.accessUser.save();
	res.json(common.getResponses('020', {avatarDir: config.liveUrl + 'storage/avatars/' + req.accessUser.avatar}));
};

User.prototype.getGroupsMembers = (req, res) => {
	if(!req.body.groupId) {
		res.json(common.getResponses('003', {}));
		return;
	}

	var groupId = req.body.groupId;
	const groupDoc = new GroupsModel({_id: groupId});
	groupDoc.getById((err, data) => {
		if(data != null && data && data._id) {
			if(data.members.indexOf(req.accessUser._id) == -1){
				res.json(common.getResponses('037', {}));
				return;
			}
	
			const reqBody = common.getPassFields(['limit','offset'])
			const userDoc = new UserModel({});
			userDoc.getData({
				...reqBody,
				condition: [
					{_id: {$in: data.members} }
				]
			}, (err, users) => {
				const rtrn = [];
				users.forEach(user => {
					user.displayName = user.fullName = user.firstName + (user.lastName ? (' ' + user.lastName) : '');
					user.avatar = config.liveUrl + 'storage/avatars/' + (user.avatar ? user.avatar : 'Avatar.jpg');
					rtrn.push(user)
				})
				res.json(common.getResponses('020', rtrn));
			});
		} else {
			res.json(common.getResponses('003', {}));
		}
	});
};

User.prototype.getRegisterUser = (req, res) => {

	if(!req.body.contacts || !req.body.contacts.length){
		res.json(common.getResponses('003', {}));
		return;
	}

	const reqBody = common.getPassFields(['limit','offset','searchText'], req.body);
	const userDoc = new UserModel({});
	const $conditions = [
		{mobileNumber: {$in: req.body.contacts.map(contact => contact.mobileNumber)}},
		{_id: {$ne: req.accessUser._id}}
	];
	userDoc.getData({
		...reqBody,
		condition: $conditions
	}, (err, users) => {
		const getUserByMobile = function(mobileNumber) {
			var rtrn = {};
			users.forEach(user => {
				if(user.mobileNumber == mobileNumber) {
					rtrn = {firstName: user.firstName, lastName: user.lastName, _id: user._id};
				}
			});
			return rtrn;
		}
		var rtrn = req.body.contacts.map(contact => {
			return {
				...contact,
				...getUserByMobile(contact.mobileNumber)
			}
		});
		res.json( common.getResponses('020', rtrn ) );
	})
};

User.prototype.getChats = (req, res) => {
	const { chatConversations, _id } = req.accessUser;
	if(chatConversations && chatConversations.length) {
		const reqBody = common.getPassFields(['limit','offset'], req.body);
		const userDoc = new UserModel({});
		const $conditions = [
			{chatConversations: {$elemMatch: {$in: chatConversations}}},
			{_id: {$ne: _id}}
		];
		reqBody.lookup = [
			{
				$lookup: {
					from: 'chats',
					localField: '_id',
					foreignField: 'senderId',
					as: 'chat'
				}
			},
			{
				$replaceRoot: {
					newRoot: {
						$mergeObjects: ["$$ROOT", {chat: { $arrayElemAt: [ "$chat", 0 ] }} ]
					}
				}
			},
			{ $sort : {"chat.createdAt": -1} }
		]
		userDoc.getData({
			...reqBody,
			condition: $conditions
		}, (err, data) => {
			const users = [];
			data.forEach(user => {
				user.displayName = user.fullName = user.firstName + (user.lastName ? (' ' + user.lastName) : '');
				user.avatar = config.liveUrl + 'storage/avatars/' + (user.avatar ? user.avatar : 'Avatar.jpg');
				users.push(user);
			})
			res.json(common.getResponses('020', users));
		});
	} else {
		res.json( common.getResponses('020', []) );
	}
}

module.exports = User;