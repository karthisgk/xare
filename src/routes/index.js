var appConfig = require('../config').initApp(__dirname);
var config = appConfig[process.env.NODE_ENV || 'development'];
var common = require('../js/common.js');
var path = require('path');
const fs = require('fs');
var SMTP = require('../config/SMTPmailConfig.js');

String.prototype.isNumeric = function(){
  return /^[0-9]+$/.test(this);
};

String.prototype.isEmail = function(){
  var pattern = /^[a-zA-Z0-9\-_]+(\.[a-zA-Z0-9\-_]+)*@[a-z0-9]+(\-[a-z0-9]+)*(\.[a-z0-9]+(\-[a-z0-9]+)*)*\.[a-z]{2,4}$/;
  return pattern.test(this);
};

function Routes(app){
	var self = this;
	var User = new (require('./user.js'));
	var Groups = new (require('./groups.js'));
	var Payment = new (require('./payments.js'));
	var upload = common.getFileUploadMiddleware();
	app.post('/login', User.login);
	app.post('/signup', User.signup);
	app.get('/logout', User.auth(), User.logOut);
	app.get('/getme', User.auth(), User.Get_Me);
	app.post('/profileexist', User.isUserExist);
	app.get('/validateuser', User.validateToken);
	app.post('/forgetpassword', User.forgetPassword);
	app.post('/setpassword', User.setPassword);
	app.post('/oauthsignin', upload.single('photoUrl'), User.OAuthSignin);
	app.post('/updateuser', upload.single('photoUrl'), User.auth(), User.updateUser);
	app.get('/getgroupsmembers', User.auth(), User.getGroupsMembers);
	app.post('/getRegisterUser', User.auth(), User.getRegisterUser);

	app.post('/groupaction', upload.single('icon'), User.auth(), Groups.index);
	app.post('/getgroups', User.auth(), Groups.getData);
	
	app.post('/makepayment', User.auth(), Payment.make);
	app.post('/raiseobjection', User.auth(), Payment.raiseObjection);
	app.post('/acceptobjection', User.auth(), Payment.acceptObjection);
	app.post('/getpayments', User.auth(), Payment.getPayments);

	app.get('/image/:dir/:img', function(req, res){

		if(!req.params.hasOwnProperty('img')){
			res.send('404 Error');
			return;
		}
		var imgPath = __dirname + '/../uploads/' + req.params.dir + '/' + req.params.img;
		if (fs.existsSync(imgPath))
			res.sendFile(path.resolve(imgPath));
		else
			res.status(404).send('404 Error');
	});

	self.r = app;
}

/*var fieds = { fieldname: 'photos',
  originalname: '7.JPG',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  destination: './src/public/uploads/tmp/',
  filename: 'photos-1555156134847.JPG',
  path: 'src/public/uploads/tmp/photos-1555156134847.JPG',
  size: 325768 }*/

module.exports = Routes;