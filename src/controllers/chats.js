const util = require('../js/common');
var config = require('../config');
const ChatModel = require('../models/chats.js');
const UserModel = require('../models/users');

module.exports = class ChatController {

    sendMessage(req, res) {

        if(!req.body.message){
            res.json(util.getResponses('003', {}));
            return;
        }

        const after = (conversationId, userId = '') => {
            const currentTime = util.current_time();
            var chatData = {
                senderId: req.accessUser._id,
                message: req.body.message,
                createdAt: new Date(currentTime)
            };
            if(conversationId != ''){
                chatData.conversationId = conversationId;
            }
            const newChat = new ChatModel(chatData);
            if(conversationId == '' && userId != ''){
                UserModel.updateMany(
                    {_id: {$in: [req.accessUser._id, userId]}},
                    {$push: {chatConversations: newChat.conversationId}},
                    (err, result) => {}
                );
            }
            const err = newChat.validateSync();
            if(err) {
                res.json(util.getResponses('003', {message: 'schema error', error: err}));
                return;
            } 
            newChat.save().then(doc => {
                res.json(util.getResponses('020', doc));
            }).catch(e => {
                res.json(util.getResponses('003', {message: 'schema error', error: e}));
            });
        }

        if(req.body.userId) {
            const userId = req.body.userId;
            req.accessUser.getConversationId(userId, (conversationId) => {
                after(conversationId, userId);
            });
        } else {
            if(!req.body.conversationId){
                res.json(util.getResponses('003', {}));
                return;
            }
            after(req.body.conversationId);
        }
    }

    getMessages(req, res) {
        const after = conversationId => {
            var chat = new ChatModel({conversationId: conversationId});
            const passField = ['offset', 'limit'];
            var criteria = util.getPassFields(passField, req.body);
            criteria.userId = req.accessUser._id;
            criteria.lookups = [
                {
                    $lookup: {
                        from: 'users',
                        localField: 'senderId',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: ["$$ROOT", {user: { $arrayElemAt: [ "$user", 0 ] }} ]
                        }
                    }
                },
                {
                    $project: {
                        "user.accessToken": 0,
                        "user.otp": 0,
                        "user.otpExpiriesIn": 0
                    }
                }
            ]
            chat.getMessages(criteria, (err, data) => {
                const messages = [];
                data.forEach(msg => {
                    const { user } = msg;
                    user.name = user.firstName;
                    user.displayName = user.fullName = user.firstName + (user.lastName ? (' ' + user.lastName) : '');
                    user.avatar = config.liveUrl + 'storage/avatars/' + (user.avatar ? user.avatar : 'Avatar.jpg');
                    msg.user = user;
                    messages.push(msg);
                })
                res.json(util.getResponses('020', messages));
            });
        }
        if(req.body.userId) {
            const userId = req.body.userId;
            if(req.accessUser._id == userId){
                res.json(util.getResponses('020', {messages: []}));
                return;
            }
            req.accessUser.getConversationId(userId, (conversationId) => {
                if( conversationId != '' ) {
                    after(conversationId);
                }  else {
                    res.json(util.getResponses('047', {}));
                }
            });
        } else {
            if(!req.body.conversationId){
                res.json(util.getResponses('003', {}));
                return;
            }
            after(req.body.conversationId);
        }
    }

    deleteMessage(req, res) {
        if(!req.body.conversationId || !req.body.messageIds || !req.body.messageIds.length){
            res.json(util.getResponses('003', {}));
            return;
        }
        const chatConversations = (req.accessUser.chatConversations && req.accessUser.chatConversations.length)
            ? req.accessUser.chatConversations : [];
        const messageIds = req.body.messageIds;
        const conversationId = req.body.conversationId;
        if(chatConversations.indexOf(conversationId) > -1) {
            var chat = new ChatModel({conversationId: conversationId});
            chat.deleteMessage(req.accessUser._id, messageIds);
            res.json(util.getResponses('020', {}));
        } else {
            res.json(util.getResponses('037', {}));
        }
    }

    deleteAllMessage(req, res) {
        if(!req.body.conversationId){
            res.json(util.getResponses('003', {}));
            return;
        }
        const chatConversations = (req.accessUser.chatConversations && req.accessUser.chatConversations.length)
            ? req.accessUser.chatConversations : [];
        const conversationId = req.body.conversationId;
        if(chatConversations.indexOf(conversationId) > -1) {
            var chat = new ChatModel({conversationId: conversationId});
            chat.deleteAll(req.accessUser._id);
            res.json(util.getResponses('020', {}));
        } else {
            res.json(util.getResponses('037', {}));
        }
    }

}