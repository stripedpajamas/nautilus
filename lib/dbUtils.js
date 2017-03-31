const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const Schema = mongoose.Schema;
const clientSchema = new Schema({
  name: String,
  domain: String,
});
const Client = mongoose.model('Client', clientSchema);
const User = new Schema({});
User.plugin(passportLocalMongoose);


module.exports = {
  passportModel: mongoose.model('User', User),
  getClients(cb) {
    Client.find((err, clients) => {
      if (err) {
        return cb(err);
      }
      return cb(null, clients);
    });
  },
  addClient(name, domain, cb) {
    const modeledClient = new Client({ name, domain });
    modeledClient.save((err) => {
      if (err) {
        return cb(err);
      }
      return cb(null, 'Success!');
    });
  },
  removeClient(name, cb) {
    Client.findOneAndRemove({ name }, (err) => {
      if (err) {
        return cb(err);
      }
      return cb(null, 'Success!');
    });
  },
};
