const express = require('express');
const app = express.Router(); 
const config = require('../config');
const common = require('../js/common');
const path = require('path');
const fs = require('fs');
const userController = new (require('../controllers/user'));
app.post('/profileexist', userController.isUserExist);

app.post('/signin', userController.signIn);
app.post('/verifyotp', userController.verifyOtp);

app.get('/getme', userController.auth(), userController.checkAccess(), userController.getProfile);

app.post('/update', common.getFileUploadMiddleware({
    uploadDir: 'avatars/'
}).single('avatar'), userController.auth(), userController.checkAccess() , userController.updateUser);

app.post('/getchats', userController.auth(), userController.checkAccess(), userController.getChats);

app.get('/logout', userController.auth(), userController.checkAccess(), userController.logOut);

module.exports = app;