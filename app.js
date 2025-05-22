const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;
const API_TOKEN = 'SEU_TOKEN_AQUI'; // 🔒 Substitua por um token seguro

app.use(cors());

// 🧱 Middleware de autenticação simples por token
app.use((req, res, next) => {
    const token = req.headers['x-api-token'];
    if (token !== API_TOKEN) {
        return res.status(403).send('❌ Acesso negado. Token inválido.');
    }
    next();
});

// 🕒 Log com data/hora
const log = (...args) => {
    console.log(`[${new Date().toLocaleString()}]`, ...args);
};

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let isReady = false;

// 📱 Evento de QR Code
client.o
