/**
 * Created by petersquicciarini on 3/14/17.
 */

const express = require('express');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');
const morgan = require('morgan');
const Shell = require('node-powershell');
const path = require('path');

const PSDIR = process.env.PSDIR || path.resolve(__dirname, '../');
const ADMIN = process.env.ADMIN || 'quovadis';
console.log('PSDIR is %s', PSDIR);

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
  const ps = new Shell();

  socket.on('initCon', (domain) => {
    console.log(`Ready to initialize PS with domain ${domain}`);
    socket.emit('commandResponse', 'Please wait while we connect to O365...');
    const adminUser = `${ADMIN}@${domain}`;
    ps.addCommand(`& "${path.resolve(PSDIR, '_launcher_specified.ps1')}"`, [{ Domain: adminUser }])
      .then(() => {
        ps.invoke().then(() => {
          console.log('No issues connecting to O365.');
          socket.emit('commandResponse', 'Successfully connected to O365. Type <b>dir</b> to list available commands.');
        }, (reason) => {
          console.log('Error connecting to O365.');
          socket.emit('commandResponse', reason);
        });
      });
  });

  socket.on('command', (command) => {
    console.log(`Got this command: ${command}`);
    ps.addCommand(command)
      .then(() => {
        ps.invoke().then((output) => {
          const htmlizedOutput = output.replace(/[\n\r]/img, '<br>');
          socket.emit('commandResponse', htmlizedOutput);
        }, (reason) => {
          console.log('Error invoking PS command.');
          socket.emit('commandResponse', reason);
        });
      });
  });
  /*
  ps.on('output', (output) => {
    socket.emit('commandResponse', output);
  });
  */
  socket.on('disconnect', () => {
    console.log('Disconnected.');
    ps.dispose();
  });
});

http.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${process.env.PORT || 3000}`);
});
