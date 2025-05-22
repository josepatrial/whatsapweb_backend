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

// Pega o token da variável de ambiente, ou usa valor padrão (recomendo trocar)
const API_TOKEN = process.env.API_TOKEN || 'meuTokenSecreto123';

app.use(cors());

// Middleware de autenticação simples por token
app.use((req, res, next) => {
    const token = req.headers['x-api-token'];
    if (token !== API_TOKEN) {
        console.log(`[${new Date().toLocaleString()}] ❌ Acesso negado. Token inválido.`);
        return res.status(403).send('❌ Acesso negado. Token inválido.');
    }
    next();
});

// Log com data/hora
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

// Evento QR Code
client.on('qr', qr => {
    log('📱 Escaneie o QR Code abaixo');
    io.emit('qr', qr);
});

// Bot pronto
client.on('ready', () => {
    isReady = true;
    log('✅ WhatsApp conectado e pronto!');
    io.emit('ready');
});

// Mensagem recebida
client.on('message', msg => {
    log(`📩 De ${msg.from}: ${msg.body}`);
    if (msg.body === '!ping') {
        msg.reply('pong 🏓');
    }
});

client.initialize();

const formatarNumero = numero => numero.replace(/\D/g, '') + '@c.us';

// Rotas HTTP

app.get('/status', (req, res) => {
    res.send(isReady ? '✅ Bot está pronto!' : '🕐 Bot não está pronto.');
});

app.get('/enviar', async (req, res) => {
    const { numero, mensagem } = req.query;

    if (!numero || !mensagem) {
        return res.status(400).send('⚠️ Informe "numero" e "mensagem".');
    }

    const numeroFormatado = formatarNumero(numero);

    try {
        await client.sendMessage(numeroFormatado, mensagem);
        res.send(`✅ Mensagem enviada para ${numero}`);
    } catch (err) {
        log('Erro ao enviar mensagem:', err);
        res.status(500).send('❌ Erro interno ao enviar mensagem.');
    }
});

app.get('/chats', async (req, res) => {
    try {
        const chats = await client.getChats();
        const lista = chats.map(chat => ({
            nome: chat.name || chat.id.user,
            id: chat.id._serialized
        }));
        res.json(lista);
    } catch (err) {
        log('Erro ao listar chats:', err);
        res.status(500).send('❌ Erro interno ao obter chats.');
    }
});

app.get('/mensagens', async (req, res) => {
    const { numero } = req.query;
    if (!numero) return res.status(400).send('⚠️ Informe o "numero".');

    try {
        const chats = await client.getChats();
        const chat = chats.find(c => c.id.user === numero.replace(/\D/g, ''));
        if (!chat) return res.status(404).send('❌ Chat não encontrado.');

        const mensagens = await chat.fetchMessages({ limit: 10 });
        const lista = mensagens.map(m => ({
            autor: m.from,
            corpo: m.body,
            data: m.timestamp
        }));

        res.json(lista);
    } catch (err) {
        log('Erro ao obter mensagens:', err);
        res.status(500).send('❌ Erro interno ao obter mensagens.');
    }
});

// Socket.IO
io.on('connection', (socket) => {
    log('🔗 Novo cliente conectado via Socket.IO');
    if (isReady) {
        socket.emit('ready');
    }
});

server.listen(PORT, () => {
    log(`🚀 Servidor rodando na porta ${PORT}`);
    log(`🔐 Token API esperado: ${API_TOKEN}`);
});
