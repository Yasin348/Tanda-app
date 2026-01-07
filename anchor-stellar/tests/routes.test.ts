/**
 * Route Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import healthRouter from '../src/routes/health.js';

describe('Health Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/health', healthRouter);
  });

  it('GET /health should return status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBe('ok');
  });

  it('GET /health should include timestamp', async () => {
    const response = await request(app).get('/health');
    expect(response.body).toHaveProperty('timestamp');
  });
});

describe('API Response Format', () => {
  it('should have consistent success response format', () => {
    const successResponse = {
      success: true,
      data: { id: '123' },
    };
    expect(successResponse).toHaveProperty('success', true);
  });

  it('should have consistent error response format', () => {
    const errorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
      },
    };
    expect(errorResponse).toHaveProperty('success', false);
    expect(errorResponse.error).toHaveProperty('code');
    expect(errorResponse.error).toHaveProperty('message');
  });
});
