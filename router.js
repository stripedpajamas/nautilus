/**
 * Created by petersquicciarini on 4/8/17.
 */

const router = require('express').Router();
const dbUtils = require('./lib/dbUtils');
const passport = require('passport');
const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;

const User = dbUtils.passportModel;

let clientNames = [];
let clients = null;

dbUtils.updateClients((err, clientList, names) => {
  if (err) throw new Error(err);
  clients = clientList;
  clientNames = names;
});

function checkAdmin(req, res, next) {
  if (!req.user.isAdmin) {
    return res.redirect('/');
  }
  return next();
}

router.post('/login', passport.authenticate('local', { failureRedirect: '/', successRedirect: '/' }));
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

router.get('/', (req, res) => {
  res.render('index', { clients: clientNames, user: req.user });
});

router.route('/shell')
  .get((req, res) => {
    res.redirect('/');
  })
  .post(ensureLoggedIn({ setReturnTo: false }),
  (req, res) => {
    const clientName = req.body.clientName;
    const clientRec = clients.find(client => clientName === client.name);
    res.render('webShell', { clientDomain: clientRec.domain, user: req.user });
  });

router.get('/admin',
  ensureLoggedIn('/'),
  checkAdmin,
  (req, res) => {
    res.render('admin', { user: req.user });
  });

router.route('/admin/clients/add')
  .all(ensureLoggedIn('/'), checkAdmin)
  .get((req, res) => {
    res.render('addClient', { user: req.user });
  })
  .post((req, res) => {
    const newClientName = req.body.newClientName;
    const newClientDomain = req.body.newClientDomain;
    if (newClientName && newClientDomain) {
      dbUtils.addClient(newClientName, newClientDomain, (err) => {
        if (err) {
          return res.render('addClient', { user: req.user, posted: true, ok: false, message: err });
        }
        return dbUtils.updateClients((updateErr) => {
          if (updateErr) {
            return res.render('addClient', {
              user: req.user,
              posted: true,
              ok: false,
              message: updateErr,
            });
          }
          return res.render('addClient', { user: req.user, posted: true, ok: true });
        });
      });
    } else {
      res.send('Did not get what we expected to get from the form.');
    }
  });

router.route('/admin/users/add')
  .all(ensureLoggedIn('/'), checkAdmin)
  .get((req, res) => {
    res.render('addUser', { user: req.user });
  })
  .post((req, res) => {
    const newUsername = req.body.newUsername;
    const newPassword = req.body.newPassword;
    const isAdmin = (req.body.isAdmin && req.body.isAdmin === 'on');
    if (newUsername && newPassword) {
      User.register(new User({ username: newUsername, isAdmin }), newPassword, (err) => {
        if (err) {
          return res.render('addUser', { user: req.user, posted: true, ok: false, message: err });
        }
        return res.render('addUser', { user: req.user, posted: true, ok: true });
      });
    } else {
      res.send('Did not get what we expected to get from the form.');
    }
  });

router.route('/admin/users/remove')
  .all(ensureLoggedIn('/'), checkAdmin)
  .get((req, res) => {
    dbUtils.getUsers((err, users) => {
      if (err) {
        res.send('Error getting users list :(');
      }
      const displayUsers = users.map(el => el.username).filter(u => u !== req.user.username);
      res.render('removeUser', { user: req.user, users: displayUsers });
    });
  })
  .post((req, res) => {
    const usernameRemove = req.body.usernameRemove;
    dbUtils.removeUser(usernameRemove, (err) => {
      if (err) {
        return res.render('removeUser', { user: req.user, posted: true, ok: false, message: err });
      }
      return res.render('removeUser', { user: req.user, posted: true, ok: true });
    });
  });

router.route('/admin/clients/remove')
  .all(ensureLoggedIn('/'), checkAdmin)
  .get((req, res) => {
    res.render('removeClient', { clients: clientNames, user: req.user });
  })
  .post((req, res) => {
    const clientName = req.body.clientName;
    dbUtils.removeClient(clientName, (err) => {
      if (err) {
        return res.render('removeClient', {
          user: req.user,
          posted: true,
          ok: false,
          message: err,
        });
      }
      return dbUtils.updateClients((updateErr) => {
        if (updateErr) {
          return res.render('removeClient', {
            user: req.user,
            posted: true,
            ok: false,
            message: updateErr,
          });
        }
        return res.render('removeClient', { user: req.user, posted: true, ok: true });
      });
    });
  });

router.route('/changePassword')
  .all(ensureLoggedIn('/'))
  .get((req, res) => {
    res.render('changePassword', { user: req.user });
  })
  .post((req, res) => {
    const newPassword = req.body.newPassword;
    const oldPassword = req.body.oldPassword;
    req.user.authenticate(oldPassword, (err, authedUser, passwordError) => {
      if (err || passwordError) {
        return res.render('changePassword', {
          user: req.user,
          posted: true,
          ok: false,
          message: err || passwordError,
        });
      }
      return authedUser.setPassword(newPassword, (setErr, changedUser, passwordError2) => {
        if (setErr || passwordError2) {
          return res.render('changePassword', {
            user: req.user,
            posted: true,
            ok: false,
            message: setErr || passwordError2,
          });
        }
        return changedUser.save((saveErr) => {
          if (saveErr) {
            return res.render('changePassword', {
              user: req.user,
              posted: true,
              ok: false,
              message: saveErr,
            });
          }
          return res.render('changePassword', { user: req.user, posted: true, ok: true });
        });
      });
    });
  });

router.route('/admin/users/change')
  .all(ensureLoggedIn('/'), checkAdmin)
  .get((req, res) => {
    dbUtils.getUsers((err, users) => {
      if (err) {
        res.send('Error getting users list :(');
      }
      const displayUsers = users.map(el => el.username).filter(u => u !== req.user.username);
      res.render('adminChangeUser', { user: req.user, users: displayUsers });
    });
  })
  .post((req, res) => {
    const userToChange = req.body.usernamePwdChange;
    const newPassword = req.body.newPassword;
    User.findByUsername(userToChange, (findErr, user) => {
      if (findErr) {
        return res.render('adminChangeUser', {
          user: req.user,
          posted: true,
          ok: false,
          message: findErr,
        });
      }
      return user.setPassword(newPassword, (err, changedUser, passwordError) => {
        if (err || passwordError) {
          return res.render('adminChangeUser', {
            user: req.user,
            posted: true,
            ok: false,
            message: err || passwordError,
          });
        }
        return changedUser.save((saveErr) => {
          if (saveErr) {
            return res.render('adminChangeUser', {
              user: req.user,
              posted: true,
              ok: false,
              message: saveErr,
            });
          }
          return res.render('adminChangeUser', { user: req.user, posted: true, ok: true });
        });
      });
    });
  });

module.exports = router;
