# Stacks-Bot

Chatbot IA pour commerces locaux, avec paiements en ligne par Stripe : il répond aux clients, prend des réservations et permet de payer des offres en ligne.

## Stack

- Node.js ≥ 16, Express 4, dotenv, cors
- IA : Groq
- E-mails : Resend
- Paiements : Stripe

## Lancer en local

```bash
npm install
npm start
```

Le serveur écoute sur le port 3000 (http://localhost:3000).

## Configuration

Crée un fichier `.env` à la racine avec :

- `GROQ_API_KEY` — clé API Groq (sans elle, le chatbot tourne en mode démo)
- `RESEND_API_KEY` — clé API Resend pour les e-mails de confirmation
- `STRIPE_SECRET_KEY` — clé secrète Stripe
- `STRIPE_WEBHOOK_SECRET` — secret du webhook Stripe
- `STRIPE_PRICE_STARTER` et `STRIPE_PRICE_BUSINESS` — identifiants des prix Stripe des offres Starter et Business
- `ADMIN_PASSWORD` — mot de passe de l'interface admin
- `PORT` — port du serveur (3000 par défaut)

## Fonctionnalités

- Widget embarquable (`public/widget.html`) à intégrer sur le site du commerce
- Gestion multi-clients (un chatbot par commerce)
- Interface admin
- Prise de réservations avec e-mail de confirmation
- Paiement en ligne via Stripe Checkout (offres Starter et Business)
