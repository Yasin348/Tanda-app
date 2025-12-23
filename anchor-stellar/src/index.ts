/**
 * Tanda Anchor Server (Stellar/Soroban)
 *
 * Backend for:
 * - Fee sponsorship (XLM via fee-bump)
 * - User profiles and KYC tracking
 * - Metrics and analytics dashboard
 *
 * The main tanda logic is on the Soroban smart contract.
 * This backend only handles auxiliary functions.
 */

import express from 'express';
import cors from 'cors';
import { SERVER_CONFIG, STELLAR_CONFIG, GAS_CONFIG, logConfig } from './config/index.js';
import { sponsorService } from './services/sponsor.js';
import { feesService } from './services/fees.js';
import { statsService } from './services/stats.js';
import { priceService } from './services/price.js';
import sponsorRouter from './routes/sponsor.js';
import usersRouter from './routes/users.js';
import healthRouter from './routes/health.js';
import tandaRouter from './routes/tanda.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check at root /health
app.get('/health', async (_req, res) => {
  const sponsorInfo = await sponsorService.getSponsorInfo();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    network: STELLAR_CONFIG.network,
    sponsorHealthy: sponsorInfo ? !sponsorInfo.isLowBalance : false,
  });
});

// Dashboard HTML
app.get('/', async (_req, res) => {
  try {
    const sponsorInfo = await sponsorService.getSponsorInfo();
    const stats = statsService.getStats();
    const kycStats = statsService.getKYCStats();
    const feesSummary = await feesService.getFeesSummary();
    const priceInfo = await priceService.getPriceInfo();

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="10">
  <title>Tanda Anchor - Stellar Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
      padding: 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 {
      text-align: center;
      font-size: 2.5rem;
      margin-bottom: 10px;
      background: linear-gradient(90deg, #00d4ff, #7b2cbf);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle { text-align: center; color: #888; margin-bottom: 30px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .card-title { font-size: 0.9rem; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
    .card-value { font-size: 2rem; font-weight: 700; }
    .card-subtitle { font-size: 0.85rem; color: #666; margin-top: 4px; }
    .card-value.xlm { color: #00d4ff; }
    .card-value.eurc { color: #10b981; }
    .card-value.users { color: #f59e0b; }
    .card-value.price { color: #a855f7; }
    .section { background: rgba(255,255,255,0.05); border-radius: 16px; padding: 24px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); }
    .section-title { font-size: 1.1rem; margin-bottom: 16px; color: #00d4ff; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); align-items: center; flex-wrap: wrap; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #888; }
    .info-value { font-family: monospace; font-size: 0.9rem; word-break: break-all; max-width: 60%; text-align: right; }
    .info-value.highlight { color: #00d4ff; font-weight: 600; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; background: #10b981; color: #fff; }
    .network-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; background: #a855f7; color: #fff; margin-left: 8px; }
    .warning-badge { background: #f59e0b; }
    .refresh-btn {
      display: block;
      margin: 20px auto;
      padding: 12px 30px;
      background: linear-gradient(90deg, #00d4ff, #7b2cbf);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 1rem;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .refresh-btn:hover { transform: scale(1.05); }
    .footer { text-align: center; color: #666; font-size: 0.85rem; margin-top: 30px; }
    .free-tag { color: #10b981; font-size: 0.85rem; font-weight: 600; }
    .fee-tag { color: #f59e0b; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Tanda Anchor</h1>
    <p class="subtitle">Stellar/Soroban Dashboard</p>

    <div class="cards">
      <div class="card">
        <div class="card-title">Balance XLM</div>
        <div class="card-value xlm">${sponsorInfo?.xlmBalance.toFixed(2) || '0.00'}</div>
        <div class="card-subtitle">Gas para sponsorship</div>
      </div>
      <div class="card">
        <div class="card-title">Comisiones EURC</div>
        <div class="card-value eurc">${stats.totalEurcCommissions.toFixed(2)}</div>
        <div class="card-subtitle">Acumuladas</div>
      </div>
      <div class="card">
        <div class="card-title">Precio XLM</div>
        <div class="card-value price">${priceInfo.xlmPriceEur.toFixed(4)}</div>
        <div class="card-subtitle">${priceInfo.source} ${priceInfo.cacheAge > 0 ? `(${Math.round(priceInfo.cacheAge / 1000)}s ago)` : ''}</div>
      </div>
      <div class="card">
        <div class="card-title">Usuarios KYC</div>
        <div class="card-value users">${kycStats.totalVerified}</div>
        <div class="card-subtitle">Verificados (Mykobo)</div>
      </div>
    </div>

    <div class="cards">
      <div class="card">
        <div class="card-title">XLM Gastado</div>
        <div class="card-value xlm">${stats.totalXlmSpent.toFixed(4)}</div>
        <div class="card-subtitle">En sponsorship</div>
      </div>
      <div class="card">
        <div class="card-title">Tx Sponsoreadas</div>
        <div class="card-value users">${stats.totalTxSponsored}</div>
        <div class="card-subtitle">Total</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">👤 Costo para Usuario (Comisión EURC)</div>
      ${feesSummary.userView.map(fee => `
      <div class="info-row">
        <span class="info-label">${fee.operation}</span>
        <span class="info-value">
          ${fee.cost === 'GRATIS'
            ? '<span class="free-tag">GRATIS</span>'
            : `<span class="fee-tag">${fee.cost}</span>`
          }
        </span>
      </div>`).join('')}
    </div>

    <div class="section">
      <div class="section-title">💰 Costo para Sponsor (Gas XLM)</div>
      <div class="info-row" style="background: rgba(0, 212, 255, 0.1); border-radius: 8px; padding: 8px; margin-bottom: 12px;">
        <span style="font-size: 0.8rem; color: #00d4ff;">Este es tu costo real por sponsorear transacciones</span>
      </div>
      ${feesSummary.sponsorView.map(fee => `
      <div class="info-row">
        <span class="info-label">${fee.operation}</span>
        <span class="info-value">
          <span style="color: #00d4ff;">${fee.costXlm.toFixed(6)} XLM</span>
          <span style="color: #888; font-size: 0.75rem; margin-left: 8px;">(€${fee.costEur.toFixed(5)})</span>
        </span>
      </div>`).join('')}
      <div class="info-row" style="border-top: 2px solid rgba(255,255,255,0.1); margin-top: 12px; padding-top: 12px;">
        <span class="info-label"><strong>Costo promedio por tx</strong></span>
        <span class="info-value">
          <span style="color: #00d4ff;">${feesSummary.totals.avgCostPerTxXlm.toFixed(4)} XLM</span>
          <span style="color: #10b981; margin-left: 8px;">(€${feesSummary.totals.avgCostPerTxEur.toFixed(4)})</span>
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">Precio XLM actual</span>
        <span class="info-value highlight">€${feesSummary.totals.xlmPriceEur.toFixed(4)}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Wallet del Sistema</div>
      <div class="info-row">
        <span class="info-label">Estado</span>
        <span>
          <span class="status-badge">Online</span>
          <span class="network-badge">${STELLAR_CONFIG.network.toUpperCase()}</span>
          ${sponsorInfo?.isLowBalance ? '<span class="status-badge warning-badge" style="margin-left:8px;">LOW BALANCE</span>' : ''}
        </span>
      </div>
      <div class="info-row">
        <span class="info-label">Sponsor Wallet</span>
        <span class="info-value" style="color: #00d4ff; font-size: 0.7rem;">${sponsorInfo?.publicKey || 'N/A'}</span>
      </div>
      ${STELLAR_CONFIG.contractId ? `
      <div class="info-row">
        <span class="info-label">Smart Contract</span>
        <span class="info-value" style="font-size: 0.7rem;">${STELLAR_CONFIG.contractId}</span>
      </div>` : `
      <div class="info-row">
        <span class="info-label">Smart Contract</span>
        <span class="info-value" style="color: #f59e0b;">No desplegado</span>
      </div>`}
      <div class="info-row" style="background: rgba(16, 185, 129, 0.1); border-radius: 8px; padding: 12px; margin-top: 8px;">
        <span style="font-size: 0.8rem; color: #888;">
          Tx estimadas restantes: ~${sponsorInfo ? Math.floor(sponsorInfo.xlmBalance / 0.0001).toLocaleString() : 0}
        </span>
      </div>
    </div>

    ${Object.keys(stats.operationCount).length > 0 ? `
    <div class="section">
      <div class="section-title">Operaciones por Tipo</div>
      ${Object.entries(stats.operationCount).map(([op, count]) => `
      <div class="info-row">
        <span class="info-label">${op}</span>
        <span class="info-value">${count}</span>
      </div>`).join('')}
    </div>` : ''}

    ${Object.keys(kycStats.byCountry).length > 0 ? `
    <div class="section">
      <div class="section-title">Usuarios por Pais</div>
      ${Object.entries(kycStats.byCountry).map(([country, count]) => `
      <div class="info-row">
        <span class="info-label">${country}</span>
        <span class="info-value">${count}</span>
      </div>`).join('')}
    </div>` : ''}

    <button class="refresh-btn" onclick="location.reload()">Actualizar</button>

    <p class="footer">Tanda Anchor Server - Stellar Network (${STELLAR_CONFIG.network})</p>
  </div>
</body>
</html>`;

    res.send(html);
  } catch (error: any) {
    console.error('[Dashboard] Error:', error);
    res.status(500).send(`<h1>Error</h1><p>${error?.message}</p>`);
  }
});

// API Routes
app.use('/api/sponsor', sponsorRouter);
app.use('/api/users', usersRouter);
app.use('/api/tanda', tandaRouter);
app.use('/api', healthRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Start server
async function start() {
  console.log('='.repeat(60));
  console.log('  TANDA ANCHOR SERVER (STELLAR/SOROBAN)');
  console.log('='.repeat(60));

  // Log configuration
  logConfig();

  // Check sponsor wallet
  console.log('\n[Server] Checking sponsor wallet...');
  const sponsorInfo = await sponsorService.getSponsorInfo();

  if (sponsorInfo) {
    console.log(`[Server] Sponsor wallet: ${sponsorInfo.publicKey}`);
    console.log(`[Server] XLM Balance: ${sponsorInfo.xlmBalance.toFixed(2)}`);
    console.log(`[Server] EURC Balance: ${sponsorInfo.eurcBalance.toFixed(2)}`);

    if (sponsorInfo.isLowBalance) {
      console.warn('\n[Server] WARNING: LOW XLM BALANCE');
      console.warn('[Server] Please fund the sponsor wallet to continue sponsoring transactions');
      console.warn(`[Server] Minimum recommended: ${GAS_CONFIG.minSponsorBalance} XLM`);
    }
  } else {
    console.error('[Server] Failed to get sponsor wallet info');
    console.error('[Server] Make sure SPONSOR_SECRET_KEY is set in .env');
  }

  // Start listening
  app.listen(SERVER_CONFIG.port, () => {
    console.log('\n' + '='.repeat(60));
    console.log(`  Server running on http://localhost:${SERVER_CONFIG.port}`);
    console.log('='.repeat(60));
    console.log('\n=== ENDPOINTS ===\n');
    console.log('  GET  /                       Dashboard');
    console.log('  GET  /health                 Health check');
    console.log('  GET  /api/anchor/status      Anchor status & stats');
    console.log('');
    console.log('  POST /api/sponsor/tx         Sponsor a transaction');
    console.log('  GET  /api/sponsor/status     Sponsor wallet status');
    console.log('  GET  /api/sponsor/fees       Get all fees');
    console.log('  GET  /api/sponsor/fee/:op    Get fee for operation');
    console.log('');
    console.log('  POST /api/users/kyc          Report KYC completed');
    console.log('  GET  /api/users/kyc/status/:pk  Get KYC status');
    console.log('  GET  /api/users/kyc/stats    Get KYC statistics');
    console.log('  GET  /api/users/:pk          Get user profile');
    console.log('  PUT  /api/users/:pk          Update user profile');
    console.log('');
    console.log('  === TANDA (Soroban Contract) ===');
    console.log('  POST /api/tanda/create       Create a new tanda');
    console.log('  POST /api/tanda/join         Join a tanda');
    console.log('  GET  /api/tanda/list         List all tandas');
    console.log('  GET  /api/tanda/:id          Get tanda details');
    console.log('  POST /api/tanda/:id/start    Start a tanda');
    console.log('  POST /api/tanda/:id/confirm-deposit  Confirm deposit');
    console.log('  POST /api/tanda/:id/payout   Advance/payout tanda');
    console.log('  POST /api/tanda/:id/leave    Leave a tanda');
    console.log('  GET  /api/tanda/:id/schedule Payment schedule');
    console.log('  GET  /api/tanda/:id/balance  Tanda balance');
    console.log('');
  });
}

start().catch((error) => {
  console.error('[Server] Fatal error:', error);
  process.exit(1);
});
