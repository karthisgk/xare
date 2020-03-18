const express = require('express');
const app = express.Router();
const common = require('../js/common');
const userController = new (require('../controllers/user'));
const groupController = new (require('../controllers/groups'));
const paymentController = new (require('../controllers/payments'));

app.post('/groupaction', 
    common.getFileUploadMiddleware({uploadDir: 'groups/'}).single('icon'), 
    userController.auth(), 
    userController.checkAccess(), 
    groupController.index
);
app.post('/getgroups', userController.auth(), userController.checkAccess(), groupController.getData);

app.post('/getregisterusers', userController.auth(), userController.checkAccess(), userController.getRegisterUser);
app.post('/getgroupmembers', userController.auth(), userController.checkAccess(), userController.getGroupsMembers);

app.post('/makepayment', userController.auth(), paymentController.make);
app.post('/raiseobjection', userController.auth(), paymentController.raiseObjection);
app.post('/acceptobjection', userController.auth(), paymentController.acceptObjection);
app.post('/getpayments', userController.auth(), paymentController.getPayments);
app.post('/getpaymentmembers', userController.auth(), paymentController.getPaymentMembers);
app.post('/completepayment', userController.auth(), paymentController.complete);
app.post('/getobjections', userController.auth(), paymentController.getObjections);

module.exports = app;