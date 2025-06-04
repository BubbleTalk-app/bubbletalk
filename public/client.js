const socket = io();

const lobby = document.getElementById('lobby');
const chatRoom = document.getElementById('chatRoom');
const roomTitle = document.getElementById('roomTitle');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendMessage = document.getElementById('sendMessage');
const createRoom = document.getElementById('createRoom');
const joinRoom = document.getElementById('joinRoom');
const roomNameInput = document.getElementById('roomName');
const passwordInput = document.getElementById('password');
const isPrivate = document.getElementById('isPrivate');
const adminPanel = document.getElementById('adminPanel');
const targetUserId = document.getElementById('targetUserId');
const kickUser = document.getElementById('kickUser');
const banUser = document.getElementById('banUser');
const hostLeft = document.getElementById('hostLeft');
const goToLobby = document.getElementById('goToLobby');

let currentRoom = '';
let isHost = false;

createRoom.onclick = () => {
  const roomName = roomNameInput.value.trim();
  const password = passwordInput.value;
  const privateRoom = isPrivate.checked;
  if (roomName) {
    socket.emit('createRoom', { roomName, password, isPrivate: privateRoom });
  }
};

joinRoom.onclick = () => {
  const roomName = roomNameInput.value.trim();
  const password = passwordInput.value;
  if (roomName) {
    socket.emit('joinRoom', { roomName, password });
  }
};

socket.on('roomCreated', (roomName) => {
  currentRoom = roomName;
  isHost = true;
  roomTitle.textContent = `Room: ${roomName}`;
  lobby.classList.add('hidden');
  chatRoom.classList.remove('hidden');
  adminPanel.classList.remove('hidden');
});

socket.on('roomJoined', (roomName) => {
  currentRoom = roomName;
  isHost = false;
  roomTitle.textContent = `Room: ${roomName}`;
  lobby.classList.add('hidden');
  chatRoom.classList.remove('hidden');
});

socket.on('newHost', (newHostId) => {
  isHost = socket.id === newHostId;
  if (isHost) {
    adminPanel.classList.remove('hidden');
    deleteRoom.classList.remove('hidden');
  } else {
    adminPanel.classList.add('hidden');
    deleteRoom.classList.add('hidden');
  }
  appendSystemMessage(`User ${newHostId} is now the host.`);
});

socket.on('error', (message) => {
  alert(message);
});

// Send message with button or ENTER key (no Shift+Enter)
sendMessage.onclick = sendChatMessage;

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // prevent newline
    sendChatMessage();
  }
});

function sendChatMessage() {
  const message = messageInput.value.trim();
  if (message) {
    socket.emit('sendMessage', { roomName: currentRoom, message });
    appendMessage('You', message, true);
    messageInput.value = '';
  }
}

function appendMessage(sender, message, isOwn = false, isHostView = false) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message-bubble');

  if (isOwn) {
    msgDiv.classList.add('own-message');
    if (isHostView) {
      // Host’s own message: no prefix
      msgDiv.classList.add('host-own-message');
      msgDiv.textContent = message;
    } else {
      // Member’s own message: no prefix
      msgDiv.textContent = message;
    }
  } else {
    msgDiv.classList.add('other-message');
    // For host, prefix bold; for member, prefix bold always
    const prefixClass = 'prefix';

    msgDiv.innerHTML = `<strong class="${prefixClass}">${sender}:</strong> ${escapeHtml(message)}`;

    if (!isHostView) {
      // Members see all prefixes bold - already applied
      msgDiv.classList.add('member-message');
    }
  }

  messages.appendChild(msgDiv);
  messages.scrollTop = messages.scrollHeight;
}

function appendSystemMessage(message) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('system-message');
  msgDiv.innerHTML = `<strong>[SYSTEM]:</strong> ${escapeHtml(message)}`;
  messages.appendChild(msgDiv);
  messages.scrollTop = messages.scrollHeight;
}

// Sanitize messages to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Listen for new messages
socket.on('newMessage', ({ sender, message }) => {
  if (sender === socket.id) return; // already shown as own message
  appendMessage(sender, message);
});

// System messages for join/leave
socket.on('userJoined', (userId) => {
  appendSystemMessage(`User ${userId} joined the room.`);
});

socket.on('userLeft', (userId) => {
  appendSystemMessage(`User ${userId} left the room.`);
});

kickUser.onclick = () => {
  const userId = targetUserId.value.trim();
  if (userId) {
    socket.emit('kickUser', { roomName: currentRoom, userId });
  }
};

banUser.onclick = () => {
  const userId = targetUserId.value.trim();
  if (userId) {
    socket.emit('banUser', { roomName: currentRoom, userId });
  }
};

socket.on('kicked', () => {
  appendSystemMessage(`User ${userId} left the room.`);
  chatRoom.classList.add('hidden');
  lobby.classList.remove('hidden');
  document.getElementById('kickedPanel').classList.remove('hidden');
  lobby.classList.add('kicked');
});

socket.on('banned', () => {
  appendSystemMessage(`User ${userId} left the room.`);
  chatRoom.classList.add('hidden');
  lobby.classList.remove('hidden');
  document.getElementById('bannedPanel').classList.remove('hidden');
  lobby.classList.add('banned');
});

socket.on('hostLeft', () => {
  appendSystemMessage(`Host has left the room and the server has closed.`);
  hostLeft.classList.remove('hidden');
  adminPanel.classList.add('hidden');
});

document.getElementById('goToLobbyFromBan').onclick = goBackToLobby;
document.getElementById('goToLobbyFromKick').onclick = goBackToLobby;

goToLobby.onclick = () => {
  goBackToLobby();
};

function goBackToLobby() {
  currentRoom = '';
  isHost = false;
  roomTitle.textContent = '';
  messages.innerHTML = '';
  lobby.classList.remove('hidden');
  chatRoom.classList.add('hidden');
  hostLeft.classList.add('hidden');
  adminPanel.classList.add('hidden');
  roomNameInput.value = '';
  passwordInput.value = '';
  isPrivate.checked = false;
  targetUserId.value = '';
}
