const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const server = http.createServer(app); // Servidor HTTP para usar com socket.io
const io = new Server(server, {
    cors: {
        origin: '*', // ou coloque o domínio do seu CRM
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

// Middleware CORS
app.use(cors());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let isReady = false;

// 📱 Evento de QR Code
client.on('qr', qr => {
    console.log('📱 Escaneie o QR Code abaixo (também enviado via Socket.IO)');
    io.emit('qr', qr); // Envia o QR para quem estiver ouvindo no frontend
});

// ✅ Pronto para uso
client.on('ready', () => {
    isReady = true;
    console.log('✅ WhatsApp conectado e pronto para uso!');
    io.emit('ready'); // Notifica os clientes conectados
});

// 💬 Mensagens recebidas
client.on('message', msg => {
    console.log(`📩 Mensagem recebida de ${msg.from}: ${msg.body}`);
    if (msg.body === '!ping') {
        msg.reply('pong 🏓');
    }
});

// Inicializa o WhatsApp Web
client.initialize();

// 🌐 Rotas HTTP
app.get('/status', (req, res) => {
    res.send(isReady ? '✅ Bot está pronto!' : '🕐 Bot não está pronto.');
});

app.get('/enviar', async (req, res) => {
    const { numero, mensagem } = req.query;

    if (!numero || !mensagem) {
        return res.status(400).send('⚠️ Envie número e mensagem nos parâmetros.');
    }

    try {
        await client.sendMessage(`${numero}@c.us`, mensagem);
        res.send(`✅ Mensagem enviada para ${numero}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('❌ Erro ao enviar mensagem.');
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
        console.error(err);
        res.status(500).send('❌ Erro ao obter chats.');
    }
});

app.get('/mensagens', async (req, res) => {
    const { numero } = req.query;

    if (!numero) return res.status(400).send('⚠️ Informe o número nos parâmetros.');

    try {
        const chats = await client.getChats();
        const chat = chats.find(c => c.id.user === numero);

        if (!chat) return res.status(404).send('❌ Chat não encontrado.');

        const mensagens = await chat.fetchMessages({ limit: 10 });
        const lista = mensagens.map(m => ({
            autor: m.from,
            corpo: m.body,
            data: m.timestamp
        }));

        res.json(lista);
    } catch (err) {
        console.error(err);
        res.status(500).send('❌ Erro ao obter mensagens.');
    }
});

// 🔌 Conexão Socket.IO
io.on('connection', (socket) => {
    console.log('🔗 Novo cliente conectado via Socket.IO');
    if (isReady) {
        socket.emit('ready');
    }
});

// 🚀 Inicia o servidor HTTP (com socket)
server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

