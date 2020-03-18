const express = require('express');
const app = express.Router();
const config = require('../config');
const common = require('../js/common.js');
const path = require('path');
const fs = require('fs');

app.get('/', config.getSettings, (req, res) => {
	res.json(common.getResponses('020', req.generalSettings));
});

app.get('/storage/:dir/:img', function(req, res){

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


/*var fieds = { fieldname: 'photos',
  originalname: '7.JPG',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  destination: './src/public/uploads/tmp/',
  filename: 'photos-1555156134847.JPG',
  path: 'src/public/uploads/tmp/photos-1555156134847.JPG',
  size: 325768 }*/

module.exports = app;