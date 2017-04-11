/*
 Powerful script to go through every domain in the database,
 connect with PS, and reset the management account password
 */

const spawn = require('child_process').spawn;
const path = require('path');
const forEachLimit = require('../node_modules/async/eachLimit');

function sanitizePassword(pwd) {
  return pwd.replace(/[$,|()&#@<>;"'{}]/g, '`$&');
}

function resetAdmin(psdir, domain, dirtyOldPwd, dirtyNewPwd, cb, outLog) {
  const oldPassword = sanitizePassword(dirtyOldPwd);
  const newPassword = sanitizePassword(dirtyNewPwd);
  const initCmd = `& '${path.resolve(psdir, 'resetAdmin.ps1')}' -Domain ${domain} -oldPassword ${oldPassword} -newPassword ${newPassword}`;
  const args = [
    '-NoLogo',
    '-InputFormat',
    'Text',
    '-ExecutionPolicy',
    'Unrestricted',
    '-Command',
    initCmd];
  const ps = spawn('powershell.exe', args);

  ps.stdout.on('data', (chunk) => {
    let stringedChunk = chunk.toString();
    if (stringedChunk.includes(`${domain} Error`) || stringedChunk.includes(`${domain} Success`)) {
      const linebreak = stringedChunk.indexOf('\n');
      if (linebreak !== -1) {
        stringedChunk = stringedChunk.slice(linebreak);
      }
      outLog.push(stringedChunk.split(' '));
    }
  });
  ps.on('close', () => cb(null));
  ps.on('error', err => cb(err));
}

module.exports = function (psdir, domains, oldPassword, newPassword, callback) {
  const output = [];
  function runReset(domain, cb) {
    resetAdmin(psdir, domain, oldPassword, newPassword, cb, output);
  }
  forEachLimit(domains, 10, runReset, (err) => {
    if (err) {
      return callback(err);
    }
    return callback(null, output);
  });
};
