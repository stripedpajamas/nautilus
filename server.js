/**
 * Created by petersquicciarini on 3/14/17.
 */

const express = require('express');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');
const morgan = require('morgan');
const path = require('path');
const spawn = require('child_process').spawn;

const PSDIR = process.env.PSDIR || path.resolve(__dirname, '../');
const ADMIN = process.env.ADMIN || 'quovadis';

// Middleware
app.use(morgan('tiny'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));
app.set('view engine', 'pug');

const domains = ['acomedsupply.com', 'messiah-nc.org']; // test domains

app.get('/', (req, res) => {
  res.render('index', { domains });
});

app.post('/', (req, res) => {
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

http.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${process.env.PORT || 3000}`);
});
