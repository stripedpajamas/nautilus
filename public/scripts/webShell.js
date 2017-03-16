const socket = io();

// initialize PS connection with the selected client domain
socket.emit('initCon', clientDomain);

const commandInput = document.getElementById('command');
const outElement = document.getElementById('out');
let lastResponse = null;

function sendCommand(command) {
  socket.emit('command', command);
}

function addResponse(response) {
  const newResponse = document.createElement('p');
  newResponse.className = 'command-output-line';
  const newResponseText = document.createTextNode(response);
  newResponse.appendChild(newResponseText);
  if (!lastResponse) {
    outElement.appendChild(newResponse);
    newResponse.scrollIntoView();
  } else {
    outElement.insertBefore(newResponse, lastResponse.nextSibling);
    newResponse.scrollIntoView();
  }
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

socket.on('commandResponse', (response) => {
  addResponse(response);
});