/**
 * Created by petersquicciarini on 3/27/17.
 */

const spawn = require('child_process').spawn;
const path = require('path');

module.exports = function (socket, PSDIR) {
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

  socket.on('initCon', (connectionInfo) => {
    socket.emit('commandResponse', 'Please wait while I connect you to Office 365...');
    let params;
    if (!connectionInfo.defaultCreds) {
      params = `-Domain ${connectionInfo.domain} -adminUsername ${connectionInfo.username} -adminPassword ${connectionInfo.password}`;
    } else {
      params = `-Domain ${connectionInfo.domain}`;
    }
    const initCmd = `& '${path.resolve(PSDIR, '_launcher_specified.ps1')}' ${params}`;
    ps.stdin.write(initCmd);
    ps.stdin.write('\r\n');
  });

  socket.on('command', (command) => {
    if (command === 'exit') {
      socket.emit('exit');
      ps.stdin.write('exit\r\n');
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
    // wait for PSSession to close out, then kill PS
    setTimeout(() => {
      ps.kill();
    }, 2000);
  });
};
