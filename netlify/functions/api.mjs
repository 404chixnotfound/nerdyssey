import { getStore } from '@netlify/blobs';
import { createHandler } from '../lib/core.mjs';

export const config = { path: '/api/*' };

export default async (req, context) => {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return new Response(JSON.stringify({ error: 'SERVER NOT CONFIGURED' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  const store = getStore({ name: 'nerdyssey', consistency: 'strong' });
  return createHandler({ store, password })(req, context.ip);
};
