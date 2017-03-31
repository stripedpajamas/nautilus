/**
 * Created by petersquicciarini on 3/27/17.
 */

const spawn = require('child_process').spawn;
const path = require('path');

module.exports = function (socket, admin, PSDIR) {
  const args = [
    '-NoLogo',
    '-NoExit',
    '-InputFormat',
    'Text',
    '-ExecutionPolicy',
    'Unrestricted',
    '-Command',
    '-'];
  const ps = spawn('powershell.exe', args);
  console.log(`Launched with PID ${ps.pid}`);

  socket.on('initCon', (domain) => {
    console.log(`Ready to initialize PS with domain ${domain}`);
    socket.emit('commandResponse', 'Please wait while we connect to O365...');
    const adminUser = `${admin}@${domain}`;
    const initCmd = `& '${path.resolve(PSDIR, '_launcher_specified.ps1')}' -Domain ${adminUser}`;
    ps.stdin.write(initCmd);
    ps.stdin.write('\r\n');
  });

  socket.on('command', (command) => {
    if (command === 'exit') {
      socket.emit('exit');
      socket.disconnect();
    } else {
      // deal with sending the command to powershell
      ps.stdin.write(`${command}\r\n`);
    }
  });
  // deal with receiving output from powershell and sending it to socket
  let outputBuffs = [];
  ps.stdout.on('data', (chunk) => {
    if (chunk.toString().indexOf('###') !== -1) { // listen for an End-of-Output token
      const htmlizedOutput = Buffer.concat(outputBuffs).toString().replace(/[\n\r]/img, '<br>');
      socket.emit('commandResponse', htmlizedOutput);
      outputBuffs = [];
    } else {
      outputBuffs.push(chunk);
    }
  });
  socket.on('disconnect', () => {
    console.log('Disconnected.');
    ps.kill();
  });
};
