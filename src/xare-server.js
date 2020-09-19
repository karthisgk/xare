
var socket  = require( 'socket.io' );
var express = require('express');
var session = require('express-session');
var ServerSocket = require('./ServerSocket');
var appConfig = require('./config').initApp(__dirname);
var config = appConfig[process.env.NODE_ENV || 'development'];
var bodyParser = require('body-parser');
const mongoose = require('mongoose');

var app = express();
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));
app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(session({
  secret: "mysqc",
  name: "mycookie",
  resave: true,
  proxy: true,
  saveUninitialized: true,
  duration: appConfig.session_time,
  activeDuration: appConfig.session_time,
  httpOnly: true,
  secure: true,
  ephemeral: true,
  cookie: {
    secure: false,
    maxAge: appConfig.session_time
  }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function(req, res, next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type,token');
    next();
});
const baseRoutes = require('./routes');
const userRoutes = require('./routes/users');
const groupRoutes = require('./routes/groups');
const chatRoutes = require('./routes/chats');
const { dbName, dbUrl } = require('./js/const');
app.use(baseRoutes);
app.use('/user', userRoutes);
app.use('/group', groupRoutes);
app.use('/chat', chatRoutes);

var server  = require('http').createServer(app);
var io = socket.listen(server);
var sv = new ServerSocket(io);


async function startApp() { 
  await mongoose.connect( dbUrl + "/" + dbName, { useCreateIndex:true, useNewUrlParser: true, useUnifiedTopology: true });
  server.listen(config.port, '0.0.0.0');
  console.log("server listening at "+config.port);
}
startApp();


