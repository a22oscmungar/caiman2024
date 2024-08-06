const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

const users = require('./jugadores');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

let connectedUsers = [];
let playerImages = {
    'player1': 'path/to/player1-image.png',
    'player2': 'path/to/player2-image.png',
    'admin': 'path/to/admin-image.png'
};

let questions = [];

// Cargar preguntas desde el archivo JSON
fs.readFile('questions.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error al leer el archivo de preguntas:', err);
        return;
    }
    questions = JSON.parse(data);
    console.log('Preguntas cargadas:', questions);
    
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (users[username] && users[username] === password) {
        if (!connectedUsers.includes(username)) {
            connectedUsers.push(username);
            io.emit('user-connected', username);
        }
        res.redirect(`/jugadores.html?username=${username}&admin=${username === 'admin'}`);
    } else {
        res.redirect('/index.html?error=1');
    }
});

app.get('/connected-players', (req, res) => {
    res.json(connectedUsers);
});

let currentQuestionData = null;

app.post('/start-game', (req, res) => {
    const { username } = req.body;

    if (username === 'admin') {
        const players = connectedUsers.filter(user => user !== 'admin');
        if (players.length === 0) {
            return res.status(400).json({ error: 'No hay jugadores disponibles' });
        }

        const randomPlayer = players[Math.floor(Math.random() * players.length)];
        const playerImage = playerImages[randomPlayer] || 'default-image.png';

        // Seleccionar una pregunta aleatoria
        currentQuestionData = {
            player: randomPlayer,
            image: playerImage,
            question: questions[Math.floor(Math.random() * questions.length)]
        };

        console.log('Pregunta actual:', currentQuestionData);
        

        io.emit('start-question', currentQuestionData);

        res.json({ message: 'Partida iniciada' });
    } else {
        res.status(403).json({ error: 'Solo el administrador puede iniciar la partida' });
    }
});

// Endpoint para obtener la pregunta actual
app.get('/current-question', (req, res) => {
    if (currentQuestionData) {
        res.json(currentQuestionData);
        console.log('Pregunta actual:', currentQuestionData);
        
    } else {
        res.status(404).json({ error: 'No hay una pregunta activa en este momento' });
    }
});


io.on('connection', (socket) => {
    console.log('Un usuario se ha conectado.');
    socket.emit('current-players', connectedUsers);

    socket.on('disconnect', () => {
        console.log('Un usuario se ha desconectado.');
        connectedUsers = connectedUsers.filter(user => user !== socket.username);
        io.emit('user-disconnected', socket.username);
    });

    socket.on('submit-answer', (data) => {
        const correctAnswer = currentQuestion.correctAnswer;

        if (data.answer === correctAnswer) {
            socket.emit('answer-result', { message: '¡Respuesta correcta!' });
        } else {
            socket.emit('answer-result', { message: 'Respuesta incorrecta.' });
        }
    });
});



server.listen(port, () => {
    console.log(`Servidor iniciado en http://localhost:${port}`);
});
