import request from 'supertest';
import app from '../app.js';

let token = '';

beforeAll(async () => {
  const email = `f${Date.now()}@ex.com`;
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ email, password: 'password123', name: 'F Test' });
  token = res.body.token;
});

describe('Folders', () => {
  it('creates and lists folders', async () => {
    // Create folder
    const created = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Folder' });
    expect(created.status).toBe(201);

    // List folders
    const listed = await request(app)
      .get('/api/folders')
      .set('Authorization', `Bearer ${token}`)
      .query({ parentId: null, page: 1, limit: 10 });
    expect(listed.status).toBe(200);
    expect(Array.isArray(listed.body.items)).toBe(true);
  });
});
