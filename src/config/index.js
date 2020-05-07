
var DB = require('./db');
var SMTP = require('./SMTPmailConfig.js');
const { liveUrl, port } = require('../js/const');

var main = {
	development: {
		name: 'xare',
		port: process.env.PORT || port
	},
	production: {
		name: 'xare',
		port: process.env.PORT || port
	},
	db: new DB(),
	smtp_config: {
	    host: "smtp.gmail.com",
	    port: 465,
	    secure: true, 
	    auth: {
	        user: "",
	        pass: ""
	    }
	},
	sms_config: {
		apikey: '3S6LNE20K8ZPQXJ2PGOWTYBIJ18K7HAT',
		secret: '4C82O55NQ4AION21',
		senderid: 'karthisgk',
		usetype: 'stage'
	},
	session_time: 999999999999,
	liveUrl: liveUrl,
	frontEndUrl: 'http://localhost:8080/',
	initApp: function(dir){
		main.app_dir = dir;
		return main;
	},
	setSMTPConfig: function(cb){
		main.db.get('settings', {}, (settings) => {
			var smtp;
			if(settings.length > 0)
				smtp = new SMTP(settings[0].smtp_config);
			else
				smtp = new SMTP(main.smtp_config);
			cb(smtp);
		});
	},
	getSettings: (req, res, next) => {
		new DB().get('settings', {}, settings => {
			if(settings.length) {
				req.generalSettings = settings[0];
				next();
			} else {
				res.status(400);
				res.send('None shall pass');
			}
		});
	}
};

module.exports = main;
