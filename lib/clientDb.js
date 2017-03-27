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
        cb(null, clients);
        return mongoose.disconnect();
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
        cb(null, 'Success!');
        return mongoose.disconnect();
      });
    });
  },
};
