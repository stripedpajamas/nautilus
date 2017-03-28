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
const clientDb = require('./lib/clientDb');
const psSocket = require('./lib/ps');

// *** passport stuff
const passport = require('passport');
const Strategy = require('passport-local').Strategy;
const db = require('./db');

passport.use(new Strategy((username, password, cb) => {
  db.users.findByUsername(username, (err, user) => {
    if (err) { return cb(err); }
    if (!user) { return cb(null, false); }
    if (user.password !== password) { return cb(null, false); }
    return cb(null, user);
  });
}));

passport.serializeUser((user, cb) => {
  cb(null, user.id);
});

passport.deserializeUser((id, cb) => {
  db.users.findById(id, (err, user) => {
    if (err) {
      return cb(err);
    }
    return cb(null, user);
  });
});
// *** end passport stuff

const app = express();
const PSDIR = process.env.PSDIR || path.resolve(__dirname, '../');
const ADMIN = process.env.ADMIN || 'quovadis';
const publicDir = path.resolve(__dirname, 'public');

// *** certificate stuff
const leStore = require('le-store-certbot');
const leChallenge = require('le-challenge-fs');
const redirectHttps = require('redirect-https');
const lex = require('greenlock-express').create({
  server: 'https://acme-v01.api.letsencrypt.org/directory',
  email: 'peter@quo.cc',
  agreeTos: true,
  challenges: { 'http-01': leChallenge.create({ webrootPath: publicDir }) },
  store: leStore.create({ configDir: './letsencrypt/' }),
  approveDomains: ['nautilus.quo.cc'],
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
  clientDb.getClients((err, clientList) => {
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
app.use(session({ secret: 'twoseventythree tomato sauce', resave: false, saveUninitialized: false, secure: true }));
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
      clientDb.addClient(newClientName, newClientDomain, (err, result) => {
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
    clientDb.removeClient(clientName, (err, result) => {
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
  psSocket(socket, ADMIN, PSDIR);
});

