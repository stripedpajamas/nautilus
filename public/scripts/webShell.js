const socket = io();

// initialize PS connection with the selected client domain
socket.emit('initCon', document.getElementById('in').getAttribute('data-domain'));

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
  const newCommandText = document.createTextNode(`ps> ${command}`);
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
  if (keyboardEvent.keyCode === 13 && commandInput.value.length) {
    sendCommand(commandInput.value);
    commandInput.value = '';
    return false;
  }
  return true;
};

function cleanExit(alreadyExited) {
  if (!alreadyExited) {
    sendCommand('exit');
  }
  addResponse('Ending session...');
  setTimeout(() => {
    window.location.href = '../';
  }, 1000);
}

document.onkeyup = function (event) {
  const e = event || window.event;
  if (e.ctrlKey && e.which === 69) {
    cleanExit();
  }
};

socket.on('commandResponse', (response) => {
  addResponse(response);
});

socket.on('exit', () => {
  cleanExit(true);
});
