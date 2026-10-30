// NERDYSSEY API core. Storage injected so it can be tested.
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';

export const NATO = ['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliet'];
const MAX_PTS = 9999999;
const TTL = 12 * 3600; // seconds
const COOKIE = 'nerdyssey_admin';

const seed = () => ({
  version: 1,
  session: 'SESSION 07',
  players: [['Alpha',4920],['Bravo',4715],['Charlie',4588],['Delta',4130],
            ['Echo',3997],['Foxtrot',3640],['Golf',3402],['Hotel',3118]].map(([name, pts]) => ({ name, pts })),
});

const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

const sha = s => createHash('sha256').update(String(s)).digest();
const validPts = n => Number.isInteger(n) && n >= 0 && n <= MAX_PTS;

export function createHandler({ store, password, s1Word = '', s1Value = '6' }) {
  const secret = createHash('sha256').update('nerdyssey|' + password).digest(); // token dies if password changes
  const sign = exp => createHmac('sha256', secret).update(String(exp)).digest('hex');
  const makeToken = () => { const exp = Math.floor(Date.now() / 1000) + TTL; return `${exp}.${sign(exp)}`; };
  const tokenOk = t => {
    if (!t) return false;
    const [exp, sig] = t.split('.');
    if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
    const good = sign(exp);
    return sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good));
  };
  const cookieOf = req => {
    for (const part of (req.headers.get('cookie') || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
    }
    return '';
  };
  const isAdmin = req => tokenOk(cookieOf(req));
  const passwordOk = p => timingSafeEqual(sha(p), sha(password));

  const load = async () => (await store.get('state', { type: 'json' })) || null;
  const loadOrSeed = async () => {
    let s = await load();
    if (!s) { s = seed(); await store.setJSON('state', s); }
    return s;
  };
  const save = async s => { s.version++; await store.setJSON('state', s); return s; };
  const pub = s => ({ version: s.version, session: s.session, players: s.players, nato: NATO });

  return async function handle(req, ip = 'unknown') {
    const url = new URL(req.url);
    const p = url.pathname.replace(/^\/\.netlify\/functions\/api/, '');
    const m = req.method;

    if (m === 'GET' && p === '/api/state') {
      const s = await loadOrSeed();
      return json({ ...pub(s), admin: isAdmin(req) });
    }

    if (m === 'POST' && p === '/api/login') {
      const failKey = 'fail:' + createHash('sha256').update(ip).digest('hex').slice(0, 16);
      const f = (await store.get(failKey, { type: 'json' })) || { n: 0, until: 0 };
      if (f.until > Date.now()) return json({ error: 'LOCKED' }, 429);
      let body = {};
      try { body = await req.json(); } catch { return json({ error: 'BAD REQUEST' }, 400); }
      if (typeof body.password === 'string' && passwordOk(body.password)) {
        if (f.n) await store.delete(failKey);
        return json({ ok: true }, 200, {
          'Set-Cookie': `${COOKIE}=${makeToken()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL}`,
        });
      }
      const n = f.n + 1;
      await store.setJSON(failKey, { n, until: n >= 5 ? Date.now() + 60000 : 0 });
      return json({ error: 'ACCESS DENIED' }, 401);
    }

    // ---- /s1 puzzle: server checks the word, value only leaves on a match ----
    if (m === 'POST' && p === '/api/s1/unlock') {
      if (!s1Word) return json({ error: 'NOT CONFIGURED' }, 503);
      const failKey = 'fails1:' + createHash('sha256').update(ip).digest('hex').slice(0, 16);
      const f = (await store.get(failKey, { type: 'json' })) || { n: 0, until: 0 };
      if (f.until > Date.now()) return json({ error: 'LOCKED' }, 429);
      let body = {};
      try { body = await req.json(); } catch { return json({ error: 'BAD REQUEST' }, 400); }
      const norm = x => String(x).trim().toLowerCase();
      if (typeof body.word === 'string' && body.word.length <= 100 && timingSafeEqual(sha(norm(body.word)), sha(norm(s1Word)))) {
        if (f.n) await store.delete(failKey);
        return json({ ok: true, value: s1Value });
      }
      const n = f.n + 1;
      // 5 wrong tries = this IP is locked permanently (until the blob key is deleted)
      await store.setJSON(failKey, { n, until: n >= 5 ? Number.MAX_SAFE_INTEGER : 0 });
      return json({ error: n >= 5 ? 'LOCKED' : 'WRONG WORD', left: Math.max(0, 5 - n) }, n >= 5 ? 429 : 401);
    }

    if (m === 'POST' && p === '/api/logout') {
      return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0` });
    }

    if (p.startsWith('/api/admin/')) {
      if (!isAdmin(req)) return json({ error: 'UNAUTHORIZED' }, 401);
      let body = {};
      if (m !== 'DELETE') { try { body = await req.json(); } catch { return json({ error: 'BAD REQUEST' }, 400); } }
      const s = await loadOrSeed();

      if (m === 'PUT' && p === '/api/admin/session') {
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
        if (!name) return json({ error: 'BAD NAME' }, 400);
        s.session = name.toUpperCase();
        return json(pub(await save(s)));
      }
      if (m === 'POST' && p === '/api/admin/players') {
        const name = NATO.find(n => n.toLowerCase() === String(body.name).toLowerCase());
        const pts = body.pts === undefined ? 0 : body.pts;
        if (!name) return json({ error: 'BAD NAME' }, 400);
        if (!validPts(pts)) return json({ error: 'BAD POINTS' }, 400);
        if (s.players.some(x => x.name === name)) return json({ error: 'DUPLICATE' }, 409);
        s.players.push({ name, pts });
        return json(pub(await save(s)));
      }
      const mm = p.match(/^\/api\/admin\/players\/([A-Za-z]+)$/);
      if (mm) {
        const pl = s.players.find(x => x.name.toLowerCase() === mm[1].toLowerCase());
        if (!pl) return json({ error: 'NOT FOUND' }, 404);
        if (m === 'PATCH') {
          if (!validPts(body.pts)) return json({ error: 'BAD POINTS' }, 400);
          pl.pts = body.pts;
          return json(pub(await save(s)));
        }
        if (m === 'DELETE') {
          s.players = s.players.filter(x => x !== pl);
          return json(pub(await save(s)));
        }
      }
    }
    return json({ error: 'NOT FOUND' }, 404);
  };
}
