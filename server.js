/**
 * Created by petersquicciarini on 3/14/17.
 */

const express = require('express');

const app = express();
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const spawn = require('child_process').spawn;
const cookieParser = require('cookie-parser');
const session = require('express-session');
const ensureLogin = require('connect-ensure-login');
const favicon = require('serve-favicon');

// *** passport stuff
const passport = require('passport');
const Strategy = require('passport-local').Strategy;

// temporary auth stuff
const users = [
  {
    id: 1,
    username: 'quovadis',
    password: 'Sith0Pi5Hoc$',
  },
];

passport.use(new Strategy({
  session: false,
}, (username, password, done) => {
  if (users[0].username === username && users[0].password === password) {
    done(null, users[0]);
  } else {
    done(null, false);
  }
}));

passport.serializeUser((user, cb) => {
  cb(null, user.id);
});
passport.deserializeUser((id, cb) => {
  if (id === 1) {
    cb(null, users[0]);
  } else {
    cb(null, null);
  }
});

// *** end passport stuff


// *** certificate stuff
const leStore = require('le-store-certbot');
const leChallenge = require('le-challenge-fs');
const redirectHttps = require('redirect-https');
const lex = require('greenlock-express').create({
  server: 'staging',
  email: 'peter@quo.cc',
  agreeTos: true,
  challenges: { 'http-01': leChallenge.create({ webrootPath: './public/.well-known/acme-challenges' }) },
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

const PSDIR = process.env.PSDIR || path.resolve(__dirname, '../');
const ADMIN = process.env.ADMIN || 'quovadis';
const domains = fs.readFileSync(path.resolve(PSDIR, 'clients.csv'), { encoding: 'UTF-8' }).split('\n');

// Middleware
app.use(favicon(path.resolve('public', 'favicon.ico')));
app.use(morgan('tiny'));
app.use(cookieParser());
app.use(session({ secret: 'twoseventythree tomato sauce', resave: false, saveUninitialized: false, secure: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'pug');
app.use(passport.initialize());
app.use(passport.session());

app.post('/login', passport.authenticate('local', { failureRedirect: '/', successRedirect: '/' }));

app.get('/', (req, res) => {
  res.render('index', { domains, user: req.user });
});

app.post('/shell', (req, res) => {
  ensureLogin.ensureLoggedIn({ setReturnTo: false });
  res.render('webShell', { clientDomain: req.body.clientDomain });
});

io.on('connection', (socket) => {
  console.log('Got a new connection.');
  const args = [
    '-NoLogo',
    '-NoExit',
    '-InputFormat',
    'Text',
    '-ExecutionPolicy',
    'Unrestricted',
    '-Command',
    '-'];
  const ps = spawn('powershell.exe', args);
  console.log(`Launched with PID ${ps.pid}`);

  socket.on('initCon', (domain) => {
    console.log(`Ready to initialize PS with domain ${domain}`);
    socket.emit('commandResponse', 'Please wait while we connect to O365...');
    const adminUser = `${ADMIN}@${domain}`;
    const initCmd = `& '${path.resolve(PSDIR, '_launcher_specified.ps1')}' -Domain ${adminUser}`;
    ps.stdin.write(initCmd);
    ps.stdin.write('\r\n');
  });

  socket.on('command', (command) => {
    console.log(`Got this command: ${command}`);
    if (command === 'exit') {
      socket.emit('exit');
      socket.disconnect();
    } else {
      // deal with sending the command to powershell
      ps.stdin.write(`${command}\r\n`);
    }
  });
  // deal with receiving output from powershell and sending it to socket
  let outputBuffs = [];
  ps.stdout.on('data', (chunk) => {
    if (chunk.toString().indexOf('###') !== -1) { // listen for an End-of-Output token
      const htmlizedOutput = Buffer.concat(outputBuffs).toString().replace(/[\n\r]/img, '<br>');
      socket.emit('commandResponse', htmlizedOutput);
      outputBuffs = [];
    } else {
      outputBuffs.push(chunk);
    }
  });
  socket.on('disconnect', () => {
    console.log('Disconnected.');
    ps.kill();
  });
});

