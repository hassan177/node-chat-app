const path = require('path');
const http = require('http');
const express = require('express');
const socketIO = require('socket.io');

const {generateMessage, generateLocationMessage} = require('./utils/message');
const {isRealString} = require('./utils/validation');
const {Users} = require('./utils/users');
var publicPath = path.join(__dirname, '../public');

const port = process.env.PORT || 5000;

var app = express();
var server = http.createServer(app);
var io = socketIO(server);
var users = new Users();

app.use(express.static(publicPath));


io.on('connection', (socket) => {
    console.log('New User connected');

    socket.on('join', (params, callback) => {
        var roomName = params.room;
        var lowerCaseRoomName = roomName.toLowerCase();
        if(!isRealString(params.name) || !isRealString(lowerCaseRoomName)) {
            return callback('Name and room name are required');
        }
        var namesArrey = users.getUserList(lowerCaseRoomName);
        var existingUsers = namesArrey.filter((user) => user === params.name);
        if(existingUsers.length !== 0) {
            return callback('User name already exist, try with another username.');
        }
        socket.join(lowerCaseRoomName);
        users.removeUser(socket.id);
        users.addUser(socket.id, params.name, lowerCaseRoomName);

        io.to(lowerCaseRoomName).emit('updateUsersList', users.getUserList(lowerCaseRoomName));
        socket.emit('newMessage', generateMessage('Admin', 'Welcome to the chat app!'));
        socket.broadcast.to(lowerCaseRoomName).emit('newMessage', generateMessage('Admin', `${params.name} has joined`));
        callback();
    });

    socket.on('createMsg', function(msg, callback) {
        var user = users.getUser(socket.id);

        if(user && isRealString(msg.text)) {
            io.to(user.room).emit('newMessage', generateMessage(user.name, msg.text));   
        }
        callback();
    });

    socket.on('createLocationMessage', (coords) => {
        var user = users.getUser(socket.id);

        if(user) {
            io.to(user.room).emit('newLocationMessage', generateLocationMessage(user.name, coords.latitude , coords.longitude));
        }        
    });

    socket.on('disconnect', () => {
        var user = users.removeUser(socket.id);

        io.to(user.room).emit('updateUsersList', users.getUserList(user.room));
        io.to(user.room).emit('newMessage', generateMessage('Admin', `${user.name} has left.`));
    });
});


server.listen(port, () => {
    console.log(`Server is up on port ${port}`);
});