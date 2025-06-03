const express = require('express');
const http = require('http');
const bcrypt = require('bcrypt');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

const rooms = {}; // { roomName: { passwordHash, hostId, users: Set, bannedUsers: Set } }

io.on('connection', (socket) => {
  socket.on('createRoom', async ({ roomName, password, isPrivate }) => {
    if (rooms[roomName]) {
      socket.emit('error', 'Room already exists.');
      return;
    }
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    rooms[roomName] = {
      passwordHash,
      isPrivate,
      hostId: socket.id,
      users: new Set([socket.id]),
      bannedUsers: new Set()
    };
    socket.join(roomName);
    socket.emit('roomCreated', roomName);
  });

  socket.on('joinRoom', async ({ roomName, password }) => {
    const room = rooms[roomName];
    if (!room) {
      socket.emit('error', 'Room does not exist.');
      return;
    }
    if (room.bannedUsers.has(socket.id)) {
      socket.emit('error', 'You are banned from this room.');
      return;
    }
    if (room.passwordHash) {
      const match = await bcrypt.compare(password, room.passwordHash);
      if (!match) {
        socket.emit('error', 'Incorrect password.');
        return;
      }
    }
    room.users.add(socket.id);
    socket.join(roomName);
    socket.emit('roomJoined', roomName);
    io.to(roomName).emit('userJoined', socket.id);
  });

  socket.on('sendMessage', ({ roomName, message }) => {
    if (rooms[roomName] && rooms[roomName].users.has(socket.id)) {
      io.to(roomName).emit('newMessage', { sender: socket.id, message });
    }
  });

  socket.on('kickUser', ({ roomName, userId }) => {
    const room = rooms[roomName];
    if (room && room.hostId === socket.id) {
      room.users.delete(userId);
      io.to(userId).emit('kicked');
      io.sockets.sockets.get(userId)?.leave(roomName);
      io.to(roomName).emit('userKicked', userId);
    }
  });

  socket.on('banUser', ({ roomName, userId }) => {
    const room = rooms[roomName];
    if (room && room.hostId === socket.id) {
      room.users.delete(userId);
      room.bannedUsers.add(userId);
      io.to(userId).emit('banned');
      io.sockets.sockets.get(userId)?.leave(roomName);
      io.to(roomName).emit('userBanned', userId);
    }
  });

  socket.on('disconnect', () => {
    for (const [roomName, room] of Object.entries(rooms)) {
      if (room.users.has(socket.id)) {
        room.users.delete(socket.id);
        io.to(roomName).emit('userLeft', socket.id);
        if (room.hostId === socket.id) {
          io.to(roomName).emit('hostLeft');
          delete rooms[roomName];
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});