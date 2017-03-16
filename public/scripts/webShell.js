const socket = io();

// initialize PS connection with the selected client domain
socket.emit('initCon', clientDomain);

const commandInput = document.getElementById('command');
const outElement = document.getElementById('out');
let lastResponse = null;

function sendCommand(command) {
  socket.emit('command', command);
  const newCommand = document.createElement('p');
  newCommand.className = 'command-output-line self';
  const newCommandText = document.createTextNode(`ps> ${command}`);
  newCommand.appendChild(newCommandText);
  if (!lastResponse) {
    outElement.appendChild(newCommand);
  } else {
    outElement.insertBefore(newCommand, lastResponse.nextSibling);
  }
  newCommand.scrollIntoView();
  lastResponse = newCommand;
}

function addResponse(response) {
  const newResponse = document.createElement('div');
  newResponse.className = 'command-output-line';
  const parsedResponse = $.parseHTML(response);
  $(newResponse).append(parsedResponse);
  if (!lastResponse) {
    outElement.appendChild(newResponse);
  } else {
    outElement.insertBefore(newResponse, lastResponse.nextSibling);
  }
  newResponse.scrollIntoView();
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

document.onkeyup = function (event) {
  const e = event || window.event;
  if (e.ctrlKey && e.which === 69) {
		cleanExit();
  }
};

function cleanExit() {
	sendCommand('exit');
	addResponse('Ending session...');
	setTimeout(() => {
		window.location.href = '../';
	}, 1000);
}

socket.on('commandResponse', (response) => {
  addResponse(response);
});