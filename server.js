/**
 * Created by petersquicciarini on 3/14/17.
 */

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const favicon = require('serve-favicon');
const cert = require('./lib/cert');
const dbUtils = require('./lib/dbUtils');
const psSocket = require('./lib/ps');
const mongoose = require('mongoose');
const router = require('./router');

// *** passport stuff
const passport = require('passport');
const LocalStrategy = require('passport-local');

const User = dbUtils.passportModel;
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
// *** end passport stuff

const app = express();
const publicDir = path.resolve(__dirname, 'public');

mongoose.connect(process.env.mongoURI, (err) => {
  if (err) {
    console.log('Could not connect to MongoDB! Things are gonna fail!');
  }
});

// *** certificate stuff
const httpsServer = cert.init({
  certEmail: process.env.certEmail,
  domainName: process.env.domainName,
  publicDir,
  app,
});
// *** end certificate stuff

const io = require('socket.io')(httpsServer);

// Middleware
app.use(favicon(path.resolve(publicDir, 'favicon.ico')));
app.use(cookieParser());
app.use(session({
  secret: process.env.sessionSecret || 'twoseventythree tomato sauce',
  resave: false,
  saveUninitialized: false,
  secure: true,
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(passport.initialize());
app.use(passport.session());
app.use(router);

const PSDIR = process.env.PSDIR || path.resolve(__dirname, '../');
const adminUser = process.env.adminUser; // the admin user used to connect to the O365 clients

io.on('connection', (socket) => {
  psSocket(socket, adminUser, PSDIR);
});

