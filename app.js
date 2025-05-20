const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 3000; // 👈 Corrigido aqui

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => {
    console.log('📱 Escaneie o QR Code abaixo:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ WhatsApp conectado e pronto para uso!');
});

client.on('message', msg => {
    console.log(`📩 Mensagem recebida de ${msg.from}: ${msg.body}`);
    if (msg.body === '!ping') {
        msg.reply('pong 🏓');
    }
});

client.initialize();

app.get('/status', (req, res) => {
    res.send(client.info ? '✅ Bot está pronto!' : '🕐 Bot não está pronto.');
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

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
