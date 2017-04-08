/**
 * Created by petersquicciarini on 4/8/17.
 */

const http = require('http');
const https = require('https');
const leStore = require('le-store-certbot');
const leChallenge = require('le-challenge-fs');
const redirectHttps = require('redirect-https');
const lex = require('greenlock-express');

function init(config) {
  const lexServ = lex.create({
    server: 'https://acme-v01.api.letsencrypt.org/directory', // product url. 'staging' for tests
    email: config.certEmail, // need a registration email address for Let's Encrypt
    agreeTos: true,
    challenges: { 'http-01': leChallenge.create({ webrootPath: config.publicDir }) },
    store: leStore.create({ configDir: './letsencrypt/' }),
    approveDomains: [config.domainName],
  });
  http.createServer(lexServ.middleware(redirectHttps())).listen(80);
  return https.createServer(lexServ.httpsOptions, lexServ.middleware(config.app)).listen(443);
}

module.exports = {
  init,
};
