/**
 * Created by petersquicciarini on 4/8/17.
 */

const router = require('express').Router();
const dbUtils = require('./lib/dbUtils');
const resetAdmin = require('./lib/resetAdmin');
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
function ensureSecondFactor(req, res, next) {
  if (req.session.secondFactor === 'duo') {
    return next();
  }
  return res.redirect('/auth-duo');
}
function handleErrors(res, endpoint, user, selected, posted, ok, message, finished) {
  return res.render(endpoint, {
    user,
    selected,
    posted,
    ok,
    message,
    finished,
  });
}

router.post('/login',
  passport.authenticate('local', { failureRedirect: '/' }), ensureSecondFactor);

router.get('/login-duo',
  ensureLoggedIn('/'),
  (req, res) => {
    res.render('login-duo', {
      user: req.user,
      host: req.query.host,
      post_action: req.query.post_action,
      sig_request: req.query.signed_request,
    });
  });

router.get('/auth-duo', ensureLoggedIn(),
  passport.authenticate('duo', { failureRedirect: '/auth-duo' }),
  (req, res, next) => next());

router.post('/auth-duo',
  passport.authenticate('duo', { failureRedirect: '/auth-duo' }),
  (req, res) => {
    req.session.secondFactor = 'duo';
    res.redirect('/');
  });

router.get('/logout', (req, res) => {
  req.logout();
  req.session.destroy();
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
  ensureSecondFactor,
  (req, res) => {
    const clientName = req.body.clientName;
    const clientRec = clients.find(client => clientName === client.name);
    // check for defaultCreds switch in client record. set switches appropriately.
    res.render('webShell', { clientRec, user: req.user });
  });

router.get('/admin',
  ensureLoggedIn('/'),
  ensureSecondFactor,
  checkAdmin,
  (req, res) => {
    res.render('admin', { user: req.user });
  });

router.route('/admin/clients/add')
  .all(ensureLoggedIn('/'), checkAdmin, ensureSecondFactor)
  .get((req, res) => {
    res.render('addClient', { user: req.user });
  })
  .post((req, res) => {
    const newClientName = req.body.newClientName;
    const newClientDomain = req.body.newClientDomain;
    const newClientUsesDefaultCreds = req.body.defaultCreds === 'on';
    if (newClientName && newClientDomain) {
      dbUtils.addClient(newClientName, newClientDomain, newClientUsesDefaultCreds, (err) => {
        if (err) {
          return res.render('addClient', { user: req.user, posted: true, ok: false, message: err });
        }
        return dbUtils.updateClients((updateErr, clientList, names) => {
          if (updateErr) {
            return res.render('addClient', {
              user: req.user,
              posted: true,
              ok: false,
              message: updateErr,
            });
          }
          clients = clientList;
          clientNames = names;
          return res.render('addClient', { user: req.user, posted: true, ok: true });
        });
      });
    } else {
      res.send('Did not get what we expected to get from the form.');
    }
  });

router.route('/admin/users/add')
  .all(ensureLoggedIn('/'), checkAdmin, ensureSecondFactor)
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
  .all(ensureLoggedIn('/'), checkAdmin, ensureSecondFactor)
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
  .all(ensureLoggedIn('/'), checkAdmin, ensureSecondFactor)
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
      return dbUtils.updateClients((updateErr, clientList, names) => {
        if (updateErr) {
          return res.render('removeClient', {
            user: req.user,
            posted: true,
            ok: false,
            message: updateErr,
          });
        }
        clients = clientList;
        clientNames = names;
        return res.render('removeClient', { user: req.user, posted: true, ok: true });
      });
    });
  });

router.route('/changePassword')
  .all(ensureLoggedIn('/'), ensureSecondFactor)
  .get((req, res) => {
    res.render('changePassword', { user: req.user });
  })
  .post((req, res) => {
    const newPassword = req.body.newPassword;
    const oldPassword = req.body.oldPassword;
    req.user.authenticate(oldPassword, (err, authedUser, passwordError) => {
      if (err || passwordError) {
        return handleErrors(res, 'changePassword', req.user, false, true, false, err || passwordError);
      }
      return authedUser.setPassword(newPassword, (setErr, changedUser, passwordError2) => {
        if (setErr || passwordError2) {
          return handleErrors(res, 'changePassword', req.user, false, true, false, setErr || passwordError2);
        }
        return changedUser.save((saveErr) => {
          if (saveErr) {
            return handleErrors(res, 'changePassword', req.user, false, true, false, saveErr);
          }
          return res.render('changePassword', { user: req.user, posted: true, ok: true });
        });
      });
    });
  });

router.route('/admin/users/change')
  .all(ensureLoggedIn('/'), checkAdmin, ensureSecondFactor)
  .get((req, res) => {
    dbUtils.getUsers((err, users) => {
      if (err) {
        res.send('Error getting users list :(');
      }
      const displayUsers = users.map(el => el.username).filter(u => u !== req.user.username);
      res.render('changeUser', { user: req.user, users: displayUsers });
    });
  })
  .post((req, res) => {
    if (req.body.userToChange) {
      User.findByUsername(req.body.userToChange, (findErr, user) => {
        if (findErr) {
          return handleErrors(res, 'changeUser', req.user, true, true, false, findErr, true);
        }
        return res.render('changeUser', {
          user: req.user,
          selected: true,
          posted: false,
          changeUser: user,
        });
      });
    } else {
      const userToChange = req.body.changeUser;
      const newPassword = req.body.newPassword;
      const isAdminSetting = (req.body.isAdmin === 'on');
      User.findByUsername(userToChange, (findErr, user) => {
        if (findErr) {
          return handleErrors(res, 'changeUser', req.user, true, true, false, findErr, true);
        }
        const userToBeChanged = user;
        if (user.isAdmin !== isAdminSetting) {
          userToBeChanged.isAdmin = isAdminSetting;
        }
        if (!newPassword.length) {
          return userToBeChanged.save((saveErr) => {
            if (saveErr) {
              return handleErrors(res, 'changeUser', req.user, true, true, false, saveErr, true);
            }
            return res.render('changeUser', {
              user: req.user,
              selected: true,
              posted: true,
              finished: true,
              ok: true });
          });
        }
        return userToBeChanged.setPassword(newPassword, (err, changedUser, passwordError) => {
          if (err || passwordError) {
            return handleErrors(res, 'changeUser', req.user, true, true, false, err || passwordError, true);
          }
          return changedUser.save((saveErr) => {
            if (saveErr) {
              return handleErrors(res, 'changeUser', req.user, true, true, false, saveErr, true);
            }
            return res.render('changeUser', {
              user: req.user,
              selected: true,
              posted: true,
              finished: true,
              ok: true });
          });
        });
      });
    }
  });

router.route('/admin/clients/change')
  .all(ensureLoggedIn('/'), checkAdmin, ensureSecondFactor)
  .get((req, res) => {
    res.render('changeClient', { clients: clientNames, user: req.user });
  })
  .post((req, res) => {
    if (req.body.clientToChange) {
      dbUtils.clientModel.findOne({ name: req.body.clientToChange }, (findErr, client) => {
        if (findErr) {
          return handleErrors(res, 'changeClient', req.user, true, true, false, findErr, true);
        }
        return res.render('changeClient', {
          user: req.user,
          selected: true,
          posted: false,
          changeClient: client,
        });
      });
    } else {
      const clientToChangeID = req.body.changeClient;
      const newName = req.body.newClientName;
      const newDomain = req.body.newClientDomain;
      const newDefaultCreds = req.body.defaultCreds === 'on';
      dbUtils.findClientById(clientToChangeID, (findErr, client) => {
        if (findErr) {
          return handleErrors(res, 'changeClient', req.user, true, true, false, findErr, true);
        }
        const clientToBeChanged = client;
        let changed = false;
        if (client.name !== newName) {
          clientToBeChanged.name = newName;
          changed = true;
        }
        if (client.domain !== newDomain) {
          clientToBeChanged.domain = newDomain;
          changed = true;
        }
        if (client.defaultCreds !== newDefaultCreds) {
          clientToBeChanged.defaultCreds = newDefaultCreds;
          changed = true;
        }
        if (changed) {
          return client.save((saveErr) => {
            if (saveErr) {
              return handleErrors(res, 'changeClient', req.user, true, true, false, saveErr, true);
            }
            return dbUtils.updateClients((updateErr, clientList, names) => {
              if (updateErr) {
                handleErrors(res, 'changeClient', req.user, true, true, false, updateErr, true);
              }
              clients = clientList;
              clientNames = names;
              return res.render('changeClient', {
                user: req.user,
                selected: true,
                posted: true,
                finished: true,
                ok: true });
            });
          });
        }
        return res.render('changeClient', {
          user: req.user,
          selected: true,
          posted: true,
          finished: true,
          ok: true });
      });
    }
  });

router.route('/admin/masterReset')
  .all(ensureLoggedIn('/'), checkAdmin, ensureSecondFactor, (req, res, next) => {
    if (req.user.username !== process.env.masterAdmin) {
      return res.redirect('/');
    }
    return next();
  })
  .get((req, res) => {
    res.render('masterReset', { user: req.user });
  })
  .post((req, res) => {
    const newPassword = req.body.newPassword;
    const oldPassword = req.body.oldPassword;
    let output;
    if (newPassword && oldPassword) {
      const domains = clients.map(client => client.domain);
      resetAdmin(process.env.PSDIR, domains, oldPassword, newPassword, (err, result) => {
        if (err) {
          return res.render('masterReset', { user: req.user, posted: true, ok: false, message: err });
        }
        const tmpOut = result.map((el, i) => ({ idx: i, val: el[1] }));
        tmpOut.sort((a, b) => +(a.val > b.val) || +(a.val === b.val) - 1);
        output = tmpOut.map(el => result[el.idx]);
        return res.render('masterReset', {
          user: req.user,
          posted: true,
          ok: true,
          output,
        });
      });
    }
  });

module.exports = router;
