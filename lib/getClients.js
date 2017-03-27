const mongoose = require('mongoose');

function getClients(cb) {
  mongoose.connect('mongodb://localhost/nautilus');
  const db = mongoose.connection;
  const clientSchema = mongoose.Schema({
    name: String,
    domain: String,
  });
  const Client = mongoose.model('Client', clientSchema);
  db.on('error', err => cb(err));
  db.on('open', () => {
    Client.find((err, clients) => {
      if (err) {
        return cb(err);
      }
      cb(null, clients);
      return mongoose.disconnect();
    });
  });
}

module.exports = getClients;
