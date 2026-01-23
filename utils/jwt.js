import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

export function signToken(payload, expiresIn = '1h') {
  if (!ENV.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  const options = { expiresIn };
  return jwt.sign(payload, ENV.JWT_SECRET, options);
}

export function verifyToken(token) {
  if (!ENV.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.verify(token, ENV.JWT_SECRET);
}
