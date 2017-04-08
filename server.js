/**
 * Created by petersquicciarini on 3/14/17.
 */

const express = require('express');
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
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

http.createServer(lex.middleware(redirectHttps())).listen(80);
const httpsServer = https.createServer(lex.httpsOptions, lex.middleware(app)).listen(443);
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
app.use(cookieParser());
app.use(session({ secret: process.env.sessionSecret || 'twoseventythree tomato sauce', resave: false, saveUninitialized: false, secure: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(passport.initialize());
app.use(passport.session());

app.post('/login', passport.authenticate('local', { failureRedirect: '/', successRedirect: '/' }));
app.get('/users/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

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
    res.render('webShell', { clientDomain: clientRec.domain, user: req.user });
  });

app.get('/admin',
  ensureLoggedIn('/'),
  (req, res) => {
    if (!req.user.isAdmin) {
      res.redirect('/');
    } else {
      res.render('admin', { user: req.user });
    }
  });

app.get('/clients/add',
  ensureLoggedIn('/'),
  (req, res) => {
    if (!req.user.isAdmin) {
      res.redirect('/');
    } else {
      res.render('addClient', { user: req.user });
    }
  });
app.get('/users/add',
  ensureLoggedIn('/'),
  (req, res) => {
    if (!req.user.isAdmin) {
      res.redirect('/');
    } else {
      res.render('addUser', {user: req.user});
    }
  });
app.get('/users/remove',
  ensureLoggedIn('/'),
  (req, res) => {
    if (!req.user.isAdmin) {
      res.redirect('/');
    } else {
      dbUtils.getUsers((err, users) => {
        if (err) {
          res.send('Error getting users list :(');
        }
        const displayUsers = users.map(el => el.username).filter(u => u !== req.user.username);
        res.render('removeUser', {user: req.user, users: displayUsers});
      });
    }
  });
app.get('/clients/remove',
  ensureLoggedIn('/'),
  (req, res) => {
    if (!req.user.isAdmin) {
      res.redirect('/');
    } else {
      res.render('removeClient', {clients: clientNames, user: req.user});
    }
  });

app.post('/users/add',
  ensureLoggedIn('/'),
  (req, res) => {
    if (!req.user.isAdmin) {
      res.redirect('/');
    } else {
      const newUsername = req.body.newUsername;
      const newPassword = req.body.newPassword;
      const isAdmin = (req.body.isAdmin && req.body.isAdmin === 'on');
      if (newUsername && newPassword) {
        User.register(new User({username: newUsername, isAdmin}), newPassword, (err) => {
          if (err) {
            return res.render('addUser', {user: req.user, posted: true, ok: false, message: err});
          }
          return res.render('addUser', {user: req.user, posted: true, ok: true});
        });
      } else {
        res.send('Did not get what we expected to get from the form.');
      }
    }
  });
app.post('/users/remove',
  ensureLoggedIn('/'),
  (req, res) => {
    if (!req.user.isAdmin) {
      res.redirect('/');
    } else {
      const usernameRemove = req.body.usernameRemove;
      dbUtils.removeUser(usernameRemove, (err) => {
        if (err) {
          return res.render('removeUser', {user: req.user, posted: true, ok: false, message: err});
        }
        return res.render('removeUser', {user: req.user, posted: true, ok: true});
      });
    }
  });

app.post('/clients/add',
  ensureLoggedIn('/'),
  (req, res) => {
    if (!req.user.isAdmin) {
      res.redirect('/');
    } else {
      const newClientName = req.body.newClientName;
      const newClientDomain = req.body.newClientDomain;
      if (newClientName && newClientDomain) {
        dbUtils.addClient(newClientName, newClientDomain, (err) => {
          if (err) {
            return res.render('addClient', {user: req.user, posted: true, ok: false, message: err});
          }
          return updateClients((updateErr) => {
            if (updateErr) {
              return res.render('addClient', {
                user: req.user,
                posted: true,
                ok: false,
                message: updateErr
              });
            }
            return res.render('addClient', {user: req.user, posted: true, ok: true});
          });
        });
      } else {
        res.send('Did not get what we expected to get from the form.');
      }
    }
  });
app.post('/clients/remove',
  ensureLoggedIn('/'),
  (req, res) => {
    if (!req.user.isAdmin) {
      res.redirect('/');
    } else {
      const clientName = req.body.clientName;
      dbUtils.removeClient(clientName, (err) => {
        if (err) {
          return res.render('removeClient', {
            user: req.user,
            posted: true,
            ok: false,
            message: err
          });
        }
        return updateClients((updateErr) => {
          if (updateErr) {
            return res.render('removeClient', {
              user: req.user,
              posted: true,
              ok: false,
              message: updateErr
            });
          }
          return res.render('removeClient', {user: req.user, posted: true, ok: true});
        });
      });
    }
  });

io.on('connection', (socket) => {
  psSocket(socket, adminUser, PSDIR);
});

