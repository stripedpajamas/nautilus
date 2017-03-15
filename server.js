/**
 * Created by petersquicciarini on 3/14/17.
 */

const express = require('express');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');
const morgan = require('morgan');

// Middleware
app.use(morgan('tiny'));
app.set('view engine', 'pug');

const formDataProc = bodyParser.urlencoded({ extended: false });

const domains = ['acomedsupply.com', 'messiah-nc.org']; // test domains

app.get('/', (req, res) => {
  res.render('index', { domains });
});

app.post('/', formDataProc, (req, res) => {
  const clientDomain = req.body.clientDomain;
  res.end(`This is the domain you chose: ${clientDomain}`);
});

io.on('connection', (socket) => {
  console.log('Got a new connection.');
  socket.on('command', (command) => {
    console.log(`Got this command: ${command}`);
  });
  socket.on('disconnect', () => {
    console.log('Disconnected.');
  });
});

http.listen(process.env.PORT || 3000, () => {
  console.log(`Listening on port ${process.env.PORT || 3000}`);
});
