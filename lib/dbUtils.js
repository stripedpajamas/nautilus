const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

mongoose.Promise = global.Promise;

const Schema = mongoose.Schema;
const clientSchema = new Schema({
  name: String,
  domain: String,
  defaultCreds: Boolean,
});
const userSchema = new Schema({
  isAdmin: Boolean,
});
userSchema.plugin(passportLocalMongoose, {
  usernameLowerCase: true,
});
const Client = mongoose.model('Client', clientSchema);
const User = mongoose.model('User', userSchema);

module.exports = {
  passportModel: User,
  clientModel: Client,
  getClients(cb) {
    Client.find(cb);
  },
  addClient(name, domain, defaultCreds, cb) {
    Client.create({
      name,
      domain,
      defaultCreds,
    }).then(() => cb(null)).catch(cb);
  },
  removeClient(name, cb) {
    Client.findOneAndRemove({ name }, cb);
  },
  findClientById(id, cb) {
    Client.findById(id, cb);
  },
  updateClients(cb) {
    const clientNames = [];
    this.getClients((err, clientList) => {
      if (err) cb(err);
      if (!clientList) {
        cb('Did not get client list from DB.');
      }
      clientList.forEach((client) => {
        clientNames.push(client.name);
      });
      clientNames.sort();
      cb(null, clientList, clientNames);
    });
  },
  getUsers(cb) {
    User.find(cb);
  },
  removeUser(username, cb) {
    User.deleteOne({ username }, cb);
  },
};
