# Tanda - Ahorro Colaborativo Descentralizado

[![Deploy to Fly.io](https://github.com/Yasin348/Tanda-app/actions/workflows/deploy.yml/badge.svg)](https://github.com/Yasin348/Tanda-app/actions/workflows/deploy.yml)

Aplicacion de ahorro colaborativo (tandas/ROSCA) sobre **Stellar** con smart contracts **Soroban** y **EURC**.

## Demo

- **Frontend**: https://tanda-frontend.fly.dev
- **Backend**: https://tanda-anchor.fly.dev

## Estructura del Proyecto

```
├── tanda-app/          # Frontend React Native + Expo (Web + iOS/Android)
├── anchor-stellar/     # Backend Node.js (Anchor server)
├── soroban-tanda/      # Smart contract Rust/Soroban
└── .github/workflows/  # CI/CD
```

## Stack Tecnologico

| Componente | Tecnologia |
|------------|------------|
| Frontend | React Native, Expo SDK 54, TypeScript, NativeWind |
| Backend | Node.js, Express, TypeScript |
| Smart Contract | Rust, Soroban SDK |
| Blockchain | Stellar Mainnet, EURC (Mykobo) |

## Quick Start

### Requisitos
- Node.js >= 18
- Rust (para compilar el smart contract)
- Expo CLI

### Instalacion

```bash
# Clonar repositorio
git clone https://github.com/Yasin348/Tanda-app.git
cd Tanda-app

# Instalar dependencias
npm install

# Iniciar desarrollo (frontend + backend)
npm start
```

### Variables de Entorno

Copia `anchor-stellar/.env.example` a `.env` y configura tus valores:
```env
PORT=3001
STELLAR_NETWORK=testnet
SPONSOR_SECRET_KEY=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
EURC_ISSUER=GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM
```

> Ver `anchor-stellar/.env.example` para todas las opciones disponibles.

## Caracteristicas

- Wallets self-custody (12 palabras)
- UX "Zero Crypto" - solo euros
- Fee-bump sponsorship (usuarios sin XLM)
- Integracion Mykobo EUR <-> EURC
- Smart contract trustless
- Biometria + PIN

## Modelo de Comisiones

| Operacion | Usuario | Sponsor (Gas) |
|-----------|---------|---------------|
| Crear tanda | 0.10 EUR | ~0.008 EUR |
| Depositar | 0.5% | ~0.008 EUR |
| Avanzar | GRATIS | ~0.008 EUR |

## Arquitectura

```
┌───────────────────────┐     ┌─────────────┐     ┌─────────────────┐
│      Expo App         │────>│   Anchor    │────>│ Soroban Contract│
│  (Web + iOS/Android)  │     │   Server    │     │    (Stellar)    │
└───────────────────────┘     └─────────────┘     └─────────────────┘
           │                         │
           v                         v
     ┌─────────────┐           ┌─────────────┐
     │   Mykobo    │           │   Stellar   │
     │    (KYC)    │           │   Network   │
     └─────────────┘           └─────────────┘
```

## API Endpoints

### Tanda Operations
- `POST /api/tanda/create` - Crear nueva tanda
- `POST /api/tanda/join` - Unirse a tanda
- `GET /api/tanda/list` - Listar tandas
- `GET /api/tanda/:id` - Detalles de tanda
- `POST /api/tanda/:id/start` - Iniciar tanda
- `POST /api/tanda/:id/confirm-deposit` - Confirmar deposito
- `POST /api/tanda/:id/payout` - Avanzar/pagar tanda

### Sponsor
- `POST /api/sponsor/tx` - Sponsorear transaccion
- `GET /api/sponsor/status` - Estado del sponsor

### Users
- `POST /api/users/kyc` - Reportar KYC completado
- `GET /api/users/kyc/status/:pk` - Estado KYC

## Desarrollo

### Frontend (tanda-app)
```bash
cd tanda-app
npm install
npx expo start
```

### Backend (anchor-stellar)
```bash
cd anchor-stellar
npm install
npm run dev
```

### Smart Contract (soroban-tanda)
```bash
cd soroban-tanda
cargo build --target wasm32-unknown-unknown --release
```

## Testing

```bash
# Backend tests
cd anchor-stellar
npm test

# Frontend tests
cd tanda-app
npm test
```

## Deployment

El proyecto usa GitHub Actions para CI/CD:
- Push a `main` -> Deploy automatico a Fly.io
- PRs -> Build y tests automaticos

## Licencia

MIT
