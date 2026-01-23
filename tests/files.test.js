import request from 'supertest';
import app from '../app.js';

let token = '';

beforeAll(async () => {
  const email = `u${Date.now()}@ex.com`;
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ email, password: 'password123', name: 'U Test' });
  token = res.body.token;
});

describe('Files', () => {
  it('lists files (empty)', async () => {
    const listed = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, limit: 10 });

    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body.items)).toBe(true);
  });
});
