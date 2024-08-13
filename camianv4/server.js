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
    'aitor': 'fotos/aitor.jpeg',
    'marcos': 'fotos/marcos.jpeg',
    'admin': 'fotos/admin.jpeg'
};

let questions = [];

// Cargar preguntas desde el archivo JSON
fs.readFile('questions.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error al leer el archivo de preguntas:', err);
        return;
    }
    questions = JSON.parse(data);
    
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    console.log(req.body);

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
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

        // Configurar la pregunta actual
        currentQuestionData = { 
            player: randomPlayer, 
            image: playerImage, 
            question: randomQuestion 
        };

        // Emitir la pregunta a través del socket
        io.emit('start-question', currentQuestionData); // Emitir el evento a todos los clientes

        // Emitir una señal a todos los jugadores para redirigir a la página de pregunta
        io.emit('redirect-to-question');

        res.json({ success: true });
    } else {
        res.status(403).json({ error: 'Solo el administrador puede iniciar la partida' });
    }
});


app.get('/current-question', (req, res) => {
    if (currentQuestionData) {
        res.json(currentQuestionData);
    } else {
        res.status(400).json({ error: 'No hay pregunta activa' });
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
        console.log('Respuesta recibida:', data.answer);
        

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
