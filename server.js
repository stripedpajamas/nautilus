/**
 * Created by petersquicciarini on 3/14/17.
 */

const express = require('express');
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
const favicon = require('serve-favicon');
const dbUtils = require('./lib/dbUtils');
const mongoose = require('mongoose');
const psSocket = require('./lib/ps');

// *** passport stuff
const passport = require('passport');
const LocalStrategy = require('passport-local');

const User = dbUtils.passportModel;

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
// *** end passport stuff

const app = express();
const PSDIR = process.env.PSDIR || path.resolve(__dirname, '../');
const adminUser = process.env.adminUser; // the admin user used to connect to the O365 clients
const publicDir = path.resolve(__dirname, 'public');
mongoose.connect(process.env.mongoURI, (err) => {
  if (err) {
    console.log('Could not connect to MongoDB! Things are gonna fail!');
  }
});

// *** certificate stuff
const leStore = require('le-store-certbot');
const leChallenge = require('le-challenge-fs');
const redirectHttps = require('redirect-https');
const lex = require('greenlock-express').create({
  server: 'https://acme-v01.api.letsencrypt.org/directory', // product url. use 'staging' for tests
  email: process.env.certEmail, // need a registration email address for Let's Encrypt
  agreeTos: true,
  challenges: { 'http-01': leChallenge.create({ webrootPath: publicDir }) },
  store: leStore.create({ configDir: './letsencrypt/' }),
  approveDomains: [process.env.domainName],
});

http.createServer(
  lex.middleware(
    redirectHttps())).listen(80, () => {
      console.log('Listening for ACME http-01 challenges');
    });
const httpsServer = https.createServer(lex.httpsOptions, lex.middleware(app)).listen(443, () => {
  console.log('Listening for ACME tls-sni-01 challenges and serving secure Nautilus app');
});
// *** end certificate stuff
const io = require('socket.io')(httpsServer);


let clientNames = [];
let clients = null;

function updateClients(cb) {
  clientNames = [];
  clients = null;
  dbUtils.getClients((err, clientList) => {
    if (err) cb(err);
    clients = clientList;
    if (!clientList) {
      cb('Did not get client list from DB.');
    }
    clientList.forEach((client) => {
      clientNames.push(client.name);
    });
    clientNames.sort();
    cb(null);
  });
}
updateClients((err) => {
  if (err) throw new Error('Could not get client list from DB.');
  console.log('Got client list from DB');
});

// Middleware
app.use(favicon(path.resolve(publicDir, 'favicon.ico')));
app.use(morgan('tiny'));
app.use(cookieParser());
app.use(session({ secret: process.env.sessionSecret || 'twoseventythree tomato sauce', resave: false, saveUninitialized: false, secure: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(passport.initialize());
app.use(passport.session());

app.post('/login', passport.authenticate('local', { failureRedirect: '/', successRedirect: '/' }));

app.get('/', (req, res) => {
  res.render('index', { clients: clientNames, user: req.user });
});

app.get('shell', (req, res) => {
  res.redirect('/');
});

app.post('/shell',
  ensureLoggedIn({ setReturnTo: false }),
  (req, res) => {
    const clientName = req.body.clientName;
    const clientRec = clients.find(client => clientName === client.name);
    res.render('webShell', { clientDomain: clientRec.domain });
  });

app.get('/admin',
  ensureLoggedIn('/'),
  (req, res) => {
    res.render('admin');
  });

app.get('/add',
  ensureLoggedIn('/'),
  (req, res) => {
    res.render('add');
  });
app.get('/remove',
  ensureLoggedIn('/'),
  (req, res) => {
    res.render('remove', { clients: clientNames });
  });

app.post('/add',
  ensureLoggedIn('/'),
  (req, res) => {
    const newClientName = req.body.newClientName;
    const newClientDomain = req.body.newClientDomain;
    if (newClientName && newClientDomain) {
      dbUtils.addClient(newClientName, newClientDomain, (err, result) => {
        if (err) {
          return res.render('add', { posted: true, ok: false, message: err });
        }
        return updateClients((updateErr) => {
          if (updateErr) {
            return res.render('add', { posted: true, ok: false, message: updateErr });
          }
          return res.render('add', { posted: true, ok: true, message: result });
        });
      });
    } else {
      res.send('Did not get what we expected to get from the form.');
    }
  });
app.post('/remove',
  ensureLoggedIn('/'),
  (req, res) => {
    const clientName = req.body.clientName;
    dbUtils.removeClient(clientName, (err, result) => {
      if (err) {
        return res.render('remove', { posted: true, ok: false, message: err });
      }
      return updateClients((updateErr) => {
        if (updateErr) {
          return res.render('remove', { posted: true, ok: false, message: updateErr });
        }
        return res.render('remove', { posted: true, ok: true, message: result });
      });
    });
  });

io.on('connection', (socket) => {
  psSocket(socket, adminUser, PSDIR);
});

