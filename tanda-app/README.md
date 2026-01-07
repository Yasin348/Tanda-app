# Tanda - Ahorro Colaborativo en Stellar

Aplicacion de ahorro colaborativo (tandas/ROSCA) sobre **Stellar** con smart contracts **Soroban** y **EURC** (Mykobo).

## Arquitectura

```
tanda-app/          # App React Native + Expo
anchor-stellar/     # Backend Node.js (Anchor server)
soroban-tanda/      # Smart contract Rust/Soroban
```

## Stack Tecnologico

### Frontend (tanda-app)
- React Native + Expo (SDK 54)
- TypeScript
- @stellar/stellar-sdk para firma de transacciones
- Zustand para estado global
- NativeWind (TailwindCSS) para estilos

### Backend (anchor-stellar)
- Node.js + Express
- TypeScript
- Soroban RPC para interaccion con smart contract
- Fee-bump sponsorship (usuarios no necesitan XLM)

### Smart Contract (soroban-tanda)
- Rust + Soroban SDK
- Desplegado en Stellar Mainnet

## Blockchain

### Stellar Mainnet
- **Network Passphrase**: `Public Global Stellar Network ; September 2015`
- **Horizon**: https://horizon.stellar.org
- **Soroban RPC**: https://soroban-rpc.mainnet.stellar.gateway.fm
- **Explorer**: https://stellar.expert

### EURC (Mykobo)
- **Issuer**: `GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM`
- **Decimales**: 7
- Stablecoin euro respaldada 1:1

### Smart Contract
- **Contract ID**: `CDB5LUCZJAM2RD5DBB5LWRYI6XGVXUPLSGW55RTGC5GFUYCFWBTDOOZZ`
- [Ver en Stellar Lab](https://lab.stellar.org/r/mainnet/contract/CDB5LUCZJAM2RD5DBB5LWRYI6XGVXUPLSGW55RTGC5GFUYCFWBTDOOZZ)

## Instalacion

```bash
# Frontend
cd tanda-app
npm install
npm run web

# Backend
cd anchor-stellar
npm install
npm run dev
```

## Estructura del Proyecto

```
tanda-app/
  src/
    components/       # Componentes reutilizables
    config/           # Configuracion
    navigation/       # React Navigation
    screens/          # Pantallas
      main/           # Home, Wallet, Tandas, Profile
      onboarding/     # Flujo inicial
      tanda/          # Crear, unirse, detalle
    services/
      anchor.ts       # Cliente del Anchor server
      stellar.ts      # Interaccion Stellar
      storage.ts      # Almacenamiento seguro
    stores/
      walletStore.ts  # Estado del wallet
      tandaStore.ts   # Estado de tandas

anchor-stellar/
  src/
    routes/
      wallet.ts       # Endpoints wallet (trustline, balance)
      tanda.ts        # Endpoints tanda (create, join, deposit)
    services/
      soroban.ts      # Interaccion smart contract
      fees.ts         # Calculo de comisiones
      price.ts        # Precio XLM/EUR (Binance/CoinGecko)

soroban-tanda/
  src/
    lib.rs            # Smart contract Rust
```

## Modelo de Negocio

### Comisiones (lo que cobra la app)
| Operacion | Comision |
|-----------|----------|
| Crear tanda | 0.10 EUR (fijo) |
| Depositar | 0.5% del monto |
| Avanzar tanda | GRATIS |

**Ejemplos de depósito:**
- Depósito de 20 EUR → 0.10 EUR comisión
- Depósito de 50 EUR → 0.25 EUR comisión
- Depósito de 100 EUR → 0.50 EUR comisión

### Gas (lo que paga el sponsor)
- El usuario NUNCA necesita XLM
- El Anchor server paga el gas via fee-bump
- Coste real: ~0.02 XLM por transaccion (~0.008 EUR)

## Flujo de una Tanda

1. **Crear**: Organizador crea tanda (monto, participantes, frecuencia)
2. **Unirse**: Participantes se unen con codigo
3. **Iniciar**: Cuando hay suficientes participantes
4. **Ciclos**: Cada ciclo:
   - Todos depositan el monto
   - Un participante recibe el pozo
   - Se avanza al siguiente turno
5. **Finalizar**: Cuando todos han recibido

## Seguridad

- Seed phrase almacenada con expo-secure-store
- Autenticacion biometrica (Face ID / Huella)
- PIN de 6 digitos como respaldo
- Transacciones firmadas en el dispositivo

## UX: Solo Euros

El usuario NUNCA ve terminologia crypto:
- "Depositar 100 euros" (no "Depositar 100 EURC")
- "Tu saldo: 350 euros" (no "Balance: 350 EURC")
- "Anadir fondos" (no "Comprar crypto")

## Desarrollo

```bash
# Frontend web (desarrollo)
cd tanda-app
npm run web

# Backend con hot-reload
cd anchor-stellar
npm run dev

# Compilar smart contract
cd soroban-tanda
cargo build --target wasm32-unknown-unknown --release
```

## Configuracion

### anchor-stellar/.env
```env
PORT=3001
STELLAR_NETWORK=mainnet
SPONSOR_SECRET_KEY=S...
CONTRACT_ID=CDB5LUCZJAM2RD5DBB5LWRYI6XGVXUPLSGW55RTGC5GFUYCFWBTDOOZZ
EURC_ISSUER=GAQRF3UGHBT6JYQZ7YSUYCIYWAF4T2SAA5237Q5LIQYJOHHFAWDXZ7NM
COMMISSION_EURC=0.10
```

## Despliegue (Fly.io)

### URLs de Produccion
- **Frontend**: https://tanda-app.fly.dev
- **Backend**: https://tanda-anchor.fly.dev

### Desplegar Backend
```bash
cd anchor-stellar
fly launch --name tanda-anchor --region mad
fly secrets set SPONSOR_SECRET_KEY=S... CONTRACT_ID=CDB5... STELLAR_NETWORK=mainnet
fly volumes create tanda_data --size 1 --region mad
fly deploy
```

### Desplegar Frontend
```bash
cd tanda-app
fly launch --name tanda-app --region mad
fly deploy
```

## Recursos

- [Stellar Docs](https://developers.stellar.org/)
- [Soroban Docs](https://developers.stellar.org/docs/build/smart-contracts)
- [EURC Mykobo](https://eurc.mykobo.co/)
- [Stellar Expert](https://stellar.expert/)
- [Fly.io Docs](https://fly.io/docs/)

## Licencia

MIT
