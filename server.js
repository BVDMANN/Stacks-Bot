import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// --- STRIPE INIT ---
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2024-06-20',
});

// --- DATABASE HELPERS ---
async function getClients() {
    try {
        const data = await fs.readFile(path.join(__dirname, 'data/clients.json'), 'utf8');
        return JSON.parse(data);
    } catch { return []; }
}

async function saveClients(clients) {
    await fs.writeFile(path.join(__dirname, 'data/clients.json'), JSON.stringify(clients, null, 2));
}

async function getAnalytics() {
    try {
        const data = await fs.readFile(path.join(__dirname, 'data/analytics.json'), 'utf8');
        return JSON.parse(data);
    } catch { return { messages_total: 0, messages_today: 0, heures_de_pointe: {} }; }
}

async function saveAnalytics(analytics) {
    await fs.writeFile(path.join(__dirname, 'data/analytics.json'), JSON.stringify(analytics, null, 2));
}

async function saveConversation(entry) {
    try {
        const filePath = path.join(__dirname, 'data/conversations.json');
        let data = [];
        try { data = JSON.parse(await fs.readFile(filePath, 'utf8')); } catch {}
        data.push(entry);
        if (data.length > 1000) data.splice(0, 100);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (e) { console.error('[ERROR] Conv save failed:', e); }
}

async function saveReservation(resv) {
    const filePath = path.join(__dirname, 'data/reservations.json');
    let data = [];
    try { data = JSON.parse(await fs.readFile(filePath, 'utf8')); } catch {}
    data.push({ ...resv, timestamp: new Date().toISOString() });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// --- EMAIL LOGIC (RESEND PRO) ---
async function sendConfirmationEmail(resv, client) {
    const API_KEY = process.env.RESEND_API_KEY;
    if (!API_KEY) return;
    try {
        const htmlContent = '<div style="font-family:sans-serif; max-width:500px; margin:auto; border:1px solid #eee; padding:20px; border-radius:20px;">' +
            '<h2 style="text-align:center; color:#333;">Confirmation de Réservation</h2>' +
            '<p>Bonjour <strong style="color:#B8860B">' + resv.name + '</strong>,</p>' +
            '<p>Votre réservation chez <strong style="color:#B8860B">' + client.nom + '</strong> est enregistrée avec succès.</p>' +
            '<div style="background:#f9f9f9; padding:15px; border-radius:15px; margin:20px 0; border-left: 5px solid #B8860B;">' +
            '<p>📅 <strong>Date:</strong> ' + resv.date + '</p>' +
            '<p>⏰ <strong>Heure:</strong> ' + resv.time + '</p>' +
            '<p>👥 <strong>Personnes:</strong> ' + resv.guests + '</p>' +
            '</div >' +
            '<p>Nous avons hâte de vous accueillir !</p>' +
            '<hr style="border:0; border-top:1px solid #eee; margin:20px 0;">' +
            '<p style="font-size:12px; color:#999; text-align:center;">Envoyé par StacksBot - Votre Assistant IA</p>' +
            '</div >';

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: 'StacksBot <contact@stacks-bot.online>',
                to: resv.email || 'client@example.com',
                subject: 'Confirmation de réservation - ' + client.nom,
                html: htmlContent
            })
        });
    } catch (e) { console.error('[EMAIL ERROR]', e); }
}

// --- AI LOGIC (GROQ) ---
async function callGroq(messages) {
    const API_KEY = process.env.GROQ_API_KEY;
    if (!API_KEY) throw new Error('NO_API_KEY');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: messages,
            temperature: 0.7,
            max_tokens: 300
        })
    });
    if (!response.ok) throw new Error('GROQ_ERROR_' + response.status);
    const data = await response.json();
    return data.choices[0].message.content;
}

// --- MIDDLEWARES & STATIC ---
app.use(cors());

const possibleRoots = [
    process.cwd(),
    __dirname,
    path.join(process.cwd(), 'chatbot-pme')
];

const resolvePath = (folder) => {
    for (const root of possibleRoots) {
        if (existsSync(path.join(root, folder))) {
            return path.join(root, folder);
        }
    }
    return path.join(__dirname, folder);
};

app.use(express.static(resolvePath('public')));
app.use(express.static(resolvePath('admin')));
app.use(express.static(resolvePath('embed')));

app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send('Webhook Error: ' + err.message);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const email = session.customer_details.email;
        const plan = session.metadata.plan;
        const clientId = session.metadata.clientId || 'client_' + Date.now();

        const clients = await getClients();
        const newClient = {
            id: clientId,
            nom: "Nouveau Client",
            email: email,
            plan: plan,
            active: true,
            colors: { primary: "#000000" },
            knowledgeBase: ""
        };
        clients.push(newClient);
        await saveClients(clients);
    }
    res.json({ received: true });
});

app.use(express.json());

// --- ROUTES ---

app.get('/', (req, res) => {
    res.sendFile(path.join(resolvePath('public'), 'index.html'));
});

app.get('/widget', (req, res) => {
    res.sendFile(path.join(resolvePath('public'), 'widget.html'));
});

app.get('/health', async (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.get('/config/public', async (req, res) => {
    const { clientId } = req.query;
    const clients = await getClients();
    const client = clients.find(c => c.id === clientId) || clients[0];
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json({
        id: client.id,
        nom: client.nom,
        ville: client.ville,
        horaires: client.horaires,
        services: client.services,
        telephone: client.telephone,
        welcomeMsg: client.welcomeMsg || 'Bonjour ! Je suis l\'assistant de ' + client.nom + '.',
        suggestions: client.services ? client.services.slice(0, 3) : ["Horaires", "Services", "Contact"],
        colors: client.colors || { primary: "#000000", accent: "#B8860B" }
    });
});

app.post('/chat', async (req, res) => {
    const { message, sessionId, clientId } = req.body;
    if (!message) return res.status(400).json({ error: 'Invalid message' });

    const clients = await getClients();
    const client = clients.find(c => c.id === clientId) || clients[0];
    const id = sessionId || 'sess_' + Date.now();
    const mode = process.env.GROQ_API_KEY ? 'real' : 'demo';

    const systemPrompt = 'Tu es l\'Expert Commercial de ' + client.nom + '. INFO: ' + client.type_commerce + ' à ' + client.adresse + ', ' + client.ville + '. Horaires: ' + client.horaires + '. Knowledge: ' + (client.knowledgeBase || '') + '. Règles: Style Apple, concis, chaleureux, termine toujours par un CTA.';

    let reply;
    try {
        if (mode === 'real') {
            reply = await callGroq([{ role: 'system', content: systemPrompt }, { role: 'user', content: message }]);
        } else {
            reply = "Mode démo: Configurez GROQ_API_KEY pour m'activer !";
        }
    } catch (e) {
        reply = "Désolé, petit souci technique. Appelez-nous au " + client.telephone;
    }

    const analytics = await getAnalytics();
    analytics.messages_total++;
    analytics.messages_today++;
    const hour = new Date().getHours().toString().padStart(2, '0');
    analytics.heures_de_pointe[hour] = (analytics.heures_de_pointe[hour] || 0) + 1;
    await saveAnalytics(analytics);
    await saveConversation({ clientId: client.id, id: Date.now(), sessionId: id, timestamp: new Date().toISOString(), question: message, reponse: reply });
    res.json({ reply, sessionId: id, timestamp: new Date().toISOString(), mode });
});

app.post('/chat/reserve', async (req, res) => {
    const { name, date, time, guests, phone, email, clientId } = req.body;
    const clients = await getClients();
    const client = clients.find(c => c.id === clientId) || clients[0];
    await saveReservation({ clientId, name, date, time, guests, phone, email });
    if (email) await sendConfirmationEmail({ name, date, time, guests, email }, client);
    res.json({ status: 'ok' });
});

app.post('/api/checkout', async (req, res) => {
    const { email, plan } = req.body;
    if (!email || !plan) return res.status(400).json({ error: 'Email and plan are required' });

    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ error: 'STRIPE_SECRET_KEY is missing on the server. Please add it to Render environment variables.' });
        }
        const priceMap = {
            'Starter': process.env.STRIPE_PRICE_STARTER || 'price_starter_default',
            'Business': process.env.STRIPE_PRICE_BUSINESS || 'price_business_default'
        };
        const priceId = priceMap[plan] || priceMap['Starter'];

        const clientId = 'client_' + Date.now();
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            customer_email: email,
            success_url: 'https://stacks-bot.online/setup?clientId=' + encodeURIComponent(clientId),
            cancel_url: 'https://stacks-bot.online/',
            metadata: { plan: plan, clientId: clientId }
        });

        res.json({ status: 'success', redirectUrl: session.url });
    } catch (e) {
        console.error('[STRIPE ERROR]', e);
        res.status(500).json({ error: 'Stripe Payment Error: ' + e.message });
    }
});

app.get('/portal', (req, res) => res.sendFile(path.join(resolvePath('public'), 'portal.html')));
app.get('/setup', (req, res) => res.sendFile(path.join(resolvePath('public'), 'setup.html')));

app.post('/api/setup', async (req, res) => {
    const { clientId, updates } = req.body;
    const clients = await getClients();
    const idx = clients.findIndex(c => c.id === clientId);
    if (idx !== -1) {
        clients[idx] = { ...clients[idx], ...updates };
        await saveClients(clients);
        res.json({ status: 'ok' });
    } else {
        res.status(404).send('Client not found');
    }
});

app.get('/admin/login', (req, res) => res.sendFile(path.join(resolvePath('admin'), 'login.html')));
app.post('/admin/auth', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) res.json({ token: 'admin-session-valid' });
    else res.status(401).json({ error: 'Incorrect' });
});
app.get('/admin', (req, res) => res.sendFile(path.join(resolvePath('admin'), 'dashboard.html')));
app.get('/admin/api/clients', async (req, res) => res.json(await getClients()));
app.post('/admin/api/clients', async (req, res) => {
    const clients = await getClients();
    const newClient = { id: 'client_' + Date.now(), ...req.body, active: true };
    clients.push(newClient);
    await saveClients(clients);
    res.json(newClient);
});
app.post('/admin/api/clients/update', async (req, res) => {
    const { id, updates } = req.body;
    const clients = await getClients();
    const idx = clients.findIndex(c => c.id === id);
    if (idx !== -1) {
        clients[idx] = { ...clients[idx], ...updates };
        await saveClients(clients);
        res.json({ status: 'ok' });
    } else res.status(404).send('Not found');
});
app.get('/admin/api/conversations', async (req, res) => {
    const data = JSON.parse(await fs.readFile(path.join(__dirname, 'data/conversations.json'), 'utf8'));
    res.json(data.reverse());
});
app.get('/admin/api/reservations', async (req, res) => {
    const data = JSON.parse(await fs.readFile(path.join(__dirname, 'data/reservations.json'), 'utf8'));
    res.json(data.reverse());
});

app.get('/embed/chatbot.js', (req, res) => {
    res.send('(function(){const s=document.createElement(\'script\');const p=new URLSearchParams(window.location.search);s.src=window.location.origin+\'/widget.js?id=\'+ (p.get(\'id\')||\'client_default\');document.head.appendChild(s);})();');
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    console.error('[FATAL ERROR] 💥', err);
    res.status(500).json({
        error: 'CRASH CRITIQUE : ' + err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

(async () => {
    console.log('\n--- 🛡️ STACKSBOT SYSTEM CHECK ---');
    const requiredKeys = {
        'GROQ_API_KEY': process.env.GROQ_API_KEY,
        'STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY,
        'STRIPE_WEBHOOK_SECRET': process.env.STRIPE_WEBHOOK_SECRET,
        'RESEND_API_KEY': process.env.RESEND_API_KEY,
        'ADMIN_PASSWORD': process.env.ADMIN_PASSWORD,
    };

    let allOk = true;
    for (const [key, value] of Object.entries(requiredKeys)) {
        if (!value) {
            console.log(`❌ ${key} : MANQUANTE`);
            allOk = false;
        } else {
            console.log(`✅ ${key} : OK`);
        }
    }

    if (!allOk) {
        console.log('\n⚠️ ATTENTION : Certaines clés sont manquantes. Le site sera en ligne, mais certaines fonctionnalités seront désactivées.');
    } else {
        console.log('\n🚀 TOUTES LES CLÉS SONT PRÉSENTES. SYSTÈME NOMINAL.');
    }
    console.log('----------------------------------\n');

    app.listen(PORT, () => {
        console.log('🚀 STACKSBOT PRODUCTION READY ON PORT ' + PORT);
    });
})();
