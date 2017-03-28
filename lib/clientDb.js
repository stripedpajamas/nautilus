const mongoose = require('mongoose');

const clientSchema = mongoose.Schema({
  name: String,
  domain: String,
});

module.exports = {
  getClients(cb) {
    const db = mongoose.createConnection('mongodb://localhost/nautilus');
    const Client = db.model('Client', clientSchema);
    db.on('error', err => cb(err));
    db.on('open', () => {
      Client.find((err, clients) => {
        if (err) {
          return cb(err);
        }
        mongoose.disconnect();
        return cb(null, clients);
      });
    });
  },
  addClient(name, domain, cb) {
    const db = mongoose.createConnection('mongodb://localhost/nautilus');
    const Client = db.model('Client', clientSchema);
    db.on('error', err => cb(err));
    db.on('open', () => {
      const modeledClient = new Client({ name, domain });
      modeledClient.save((err) => {
        if (err) {
          return cb(err);
        }
        mongoose.disconnect();
        return cb(null, 'Success!');
      });
    });
  },
  removeClient(name, cb) {
    const db = mongoose.createConnection('mongodb://localhost/nautilus');
    const Client = db.model('Client', clientSchema);
    db.on('error', err => cb(err));
    db.on('open', () => {
      Client.findOneAndRemove({ name }, (err) => {
        if (err) {
          return cb(err);
        }
        mongoose.disconnect();
        return cb(null, 'Success!');
      });
    });
  },
};
