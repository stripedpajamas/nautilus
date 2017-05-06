/**
 * Module dependencies.
 */
const passport = require('passport');
const duo = require('duo_web');
const url = require('url');
// const util = require('util');
const utils = require('./utils');

class Strategy extends passport.Strategy {
  constructor(ikey, skey, host, loginUrl) {
    super();
    this.ikey = ikey;
    this.skey = skey;
    this.akey = utils.randomKey(44);
    this.host = host;
    this.loginUrl = loginUrl;
    this.name = 'duo';
  }
  authenticate(req, options) {
    const sigResponse = req.body.sig_response;
    if (sigResponse != null) {
      const userName = duo.verify_response(this.ikey, this.skey, this.akey, sigResponse);
      if (userName != null) {
        return this.success(req.user);
      }
      return this.fail();
    }
    const parsed = url.parse(this.loginUrl, true);
    const signed = duo.sign_request(this.ikey, this.skey, this.akey, req.user.username);
    parsed.query.signed_request = signed;
    parsed.query.host = this.host;
    // overwrite the url with the a different one to post to if passed
    parsed.query.post_action = utils.originalURL(req, {
      proxy: options.trustProxy,
      url: options.postUrl,
    });

    const location = url.format(parsed);
    return this.redirect(location);
  }
}
/**
 * `Strategy` constructor.
 *
 * The Duo authentication strategy authenticates requests based on the
 * Duo security two-factor web authentication method.
 *
 * Applications must supply the integration key, secret key,
 * application host, and the login URL for the UI, which
 * contains the iframe for the Duo web SDK
 * The Duo iframe will display the UI to either enroll, authenticate, or deny users.
 * Upon successful authentication, the user will be redirected
 * back to the original request that triggered the
 * two-factor authentication
 * ikey: '1234567890ABCD',
 * skey: '1234567890ABCD1234567890ABCD',
 * host: 'api-xxxxxxxx.duosecurity.com',
 * loginUrl: '/login-duo',
 *
 * Examples:
 *
 *     passport.use(new DuoStrategy(ikey, skey, host, loginUrl));
 *
 * References:
 *  - [Duo Web SDK](https://www.duosecurity.com/docs/duoweb)
 *
 * @param {String} ikey
 * @param {String} skey
 * @param {String} host
 * @param {String} loginUrl
 * @api public
 */
/*
function Strategy(ikey, skey, host, loginUrl) {
  this.ikey = ikey;
  this.skey = skey;
  this.akey = utils.randomKey(44);
  this.host = host;
  this.loginUrl = loginUrl;
  passport.Strategy.call(this);
  this.name = 'duo';
}
*/
/**
 * Inherit from `passport.Strategy`.
 */
/*
util.inherits(Strategy, passport.Strategy);
*/
/**
 * Authenticate request based on Duo 2-factory authentication.
 *
 * @param {Object} req
 * @api protected
 */
/*
Strategy.prototype.authenticate = (req, options) => {
  const sigResponse = req.body.sig_response;
  if (sigResponse != null) {
    const userName = duo.verify_response(this.ikey, this.skey, this.akey, sigResponse);
    if (userName != null) {
      return this.success(req.user);
    }
    return this.fail();
  }
  const parsed = url.parse(this.loginUrl, true);
  const signed = duo.sign_request(this.ikey, this.skey, this.akey, req.user.username);
  parsed.query.signed_request = signed;
  parsed.query.host = this.host;
  // overwrite the url with the a different one to post to if passed
  parsed.query.post_action = utils.originalURL(req, {
    proxy: options.trustProxy,
    url: options.postUrl,
  });

  const location = url.format(parsed);
  return this.redirect(location);
};
*/

/**
 * Expose `Strategy`.
 */
module.exports = Strategy;
