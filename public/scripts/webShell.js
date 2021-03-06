const socket = io();

// initialize PS connection with the selected client domain
function init(domain, username, password) {
  const connectionInfo = {
    domain,
    defaultCreds: true,
  };
  if (username && password) {
    connectionInfo.username = username;
    connectionInfo.password = password;
    connectionInfo.defaultCreds = false;
  }
  socket.emit('initCon', connectionInfo);
}

const commandInput = document.getElementById('command');
const outElement = document.getElementById('out');
let lastResponse = null;

function scrollToBottom () {
  document.body.scrollTop = document.body.scrollHeight;
}

function sendCommand(command) {
  socket.emit('command', command);
  const newCommand = document.createElement('p');
  newCommand.className = 'command-output-line self';
  const newCommandText = document.createTextNode('ps> ' + command);
  newCommand.appendChild(newCommandText);
  outElement.appendChild(newCommand);
  scrollToBottom();
  lastResponse = newCommand;
}

function addResponse(response) {
  const newResponse = document.createElement('div');
  newResponse.className = 'command-output-line';
  const parsedResponse = $.parseHTML(response);
  $(newResponse).append(parsedResponse);
  outElement.appendChild(newResponse);
  scrollToBottom();
  lastResponse = newResponse;
}

commandInput.onkeydown = function (keyboardEvent) {
  if (keyboardEvent.keyCode === 13) {
    sendCommand(commandInput.value.trim().toLowerCase());
    commandInput.value = '';
    return false;
  }
  return true;
};

function cleanExit() {
  addResponse('Ending session...');
  setTimeout(function () {
    window.location.href = '../';
  }, 1000);
}

document.onkeyup = function (event) {
  const e = event || window.event;
  if (e.ctrlKey && e.which === 69) {
    sendCommand('exit');
  }
};

socket.on('commandResponse', function (response) {
  addResponse(response);
});

socket.on('exit', function () {
  cleanExit();
});
