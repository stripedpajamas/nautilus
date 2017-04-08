const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const Schema = mongoose.Schema;
const clientSchema = new Schema({
  name: String,
  domain: String,
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
  getClients(cb) {
    Client.find(cb);
  },
  addClient(name, domain, cb) {
    const modeledClient = new Client({ name, domain });
    modeledClient.save(cb);
  },
  removeClient(name, cb) {
    Client.findOneAndRemove({ name }, cb);
  },
  getUsers(cb) {
    User.find(cb);
  },
  removeUser(username, cb) {
    User.deleteOne({ username }, cb);
  },
};
