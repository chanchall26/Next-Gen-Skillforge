import { Hono } from 'hono';
import { makeSessionCookie, type Env } from '../session';
import { persistSession } from '../store';
import { summarizeHistory } from '../history';
import { linkSignature, isUserProfile } from '../validate';
import type { SocialLinks, DashboardSessionData } from '../types';

const app = new Hono<{
  Bindings: Env;
  Variables: { session: DashboardSessionData; userId: string | null; secure: boolean };
}>();

app.get('/', (c) => {
  return c.json({ history: summarizeHistory(c.get('session')) });
});

app.post('/restore', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body.' }, 400);
  }

  const index = body && typeof body === 'object' ? (body as Record<string, unknown>).index : null;
  const session = c.get('session');
  const history = session.analysisHistory ?? [];
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= history.length) {
    return c.json({ error: 'Invalid history index.' }, 400);
  }

  const entry = history[index];
  if (!isUserProfile(entry.profile)) {
    return c.json({ error: 'This history entry cannot be restored.' }, 400);
  }

  // Point the saved links at the restored profile, otherwise GET
  // /api/session/analysis would treat it as stale and delete it.
  const links = (entry.profile as { links?: SocialLinks }).links;
  session.preferences = { ...(session.preferences ?? {}), links };
  session.analysis = { ...entry, signature: linkSignature(links) };
  const { cookieValue } = await persistSession(c.env, session, c.get('userId'));

  return c.json(
    { ok: true, analysis: session.analysis },
    { headers: { 'Set-Cookie': makeSessionCookie(cookieValue, c.get('secure')) } },
  );
});

export default app;
