const express = require('express');
const app = express.Router();
const userController = new (require('../controllers/user.js'));
const chatController = new (require('../controllers/chats.js'));
app.post('/send', userController.auth(), chatController.sendMessage);
app.post('/', userController.auth(), chatController.getMessages);
app.post('/delete', userController.auth(), chatController.deleteMessage);
app.post('/deleteall', userController.auth(), chatController.deleteAllMessage);
module.exports = app;