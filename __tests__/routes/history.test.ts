import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import historyRoute from '../../src/routes/history';
import analysisRoute from '../../src/routes/analysis';
import { addToHistory, MAX_HISTORY } from '../../src/history';
import { linkSignature } from '../../src/validate';
import type { Env } from '../../src/session';
import type { DashboardSessionData, StoredAnalysis } from '../../src/types';

function makeProfile(tag: string, github: string) {
  const skills = [{ skill: 'JavaScript', value: 85, fullMark: 100 }];
  return {
    links: {
      github,
      linkedin: '',
      resume: '',
      twitter: '',
      portfolio: '',
      devto: '',
    },
    technicalSkills: skills,
    softSkills: skills,
    jobRecommendations: [],
    aiSummary: {
      overview: `Overview ${tag}`,
      strengths: [],
      gaps: [],
      industryRelevanceScore: 70,
      atsScore: 60,
      atsFeedback: [],
      industryInsights: '',
      topSkills: [],
    },
    learningPath: [],
  };
}

function makeAnalysis(n: number): StoredAnalysis {
  const profile = makeProfile(String(n), `https://github.com/user${n}`);
  return {
    signature: linkSignature(profile.links),
    profile,
    createdAt: new Date(2026, 0, n + 1).toISOString(),
  };
}

let session: DashboardSessionData;
let app: Hono<any>;

const env: Env = {
  SESSION_KV: {
    get: async () => null,
    put: async () => {},
    delete: async () => {},
  },
  SESSION_SECRET: 'test-secret',
};

beforeEach(() => {
  session = {};
  app = new Hono();
  app.use('*', async (c, next) => {
    c.set('session', session);
    c.set('userId', 'user-1');
    c.set('secure', false);
    await next();
  });
  app.route('/api/session/analysis', analysisRoute);
  app.route('/api/session/history', historyRoute);
});

const post = (path: string, body: unknown) =>
  app.request(path, { method: 'POST', body: JSON.stringify(body) }, env);

describe('addToHistory', () => {
  it('keeps newest first and caps at 10 entries', () => {
    for (let i = 0; i < 12; i++) addToHistory(session, makeAnalysis(i));
    expect(session.analysisHistory).toHaveLength(MAX_HISTORY);
    expect(session.analysisHistory?.[0].createdAt).toBe(makeAnalysis(11).createdAt);
    expect(session.analysisHistory?.[9].createdAt).toBe(makeAnalysis(2).createdAt);
  });
});

describe('POST /api/session/analysis', () => {
  it('records the saved analysis in the history', async () => {
    const a = makeAnalysis(1);
    const res = await post('/api/session/analysis', {
      analysis: { signature: a.signature, profile: a.profile },
    });
    expect(res.status).toBe(200);
    expect(session.analysisHistory).toHaveLength(1);
    expect(session.analysisHistory?.[0].signature).toBe(a.signature);
  });
});

describe('GET /api/session/history', () => {
  it('returns an empty list when there is no history', async () => {
    const res = await app.request('/api/session/history', {}, env);
    expect(await res.json()).toEqual({ history: [] });
  });

  it('returns a light summary, newest first, without full profiles', async () => {
    addToHistory(session, makeAnalysis(1));
    addToHistory(session, makeAnalysis(2));
    session.analysis = session.analysisHistory?.[0];
    const res = await app.request('/api/session/history', {}, env);
    const { history } = (await res.json()) as { history: any[] };
    expect(history.map((h) => h.overview)).toEqual(['Overview 2', 'Overview 1']);
    expect(history[0].current).toBe(true);
    expect(history[1].current).toBe(false);
    expect(history[0].profile).toBeUndefined();
  });
});

describe('POST /api/session/history/restore', () => {
  beforeEach(() => {
    addToHistory(session, makeAnalysis(1));
    addToHistory(session, makeAnalysis(2));
    session.analysis = session.analysisHistory?.[0];
  });

  it('restores an older entry and keeps it valid for the current links', async () => {
    const res = await post('/api/session/history/restore', { index: 1 });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('session=');
    expect((session.analysis?.profile as any).aiSummary.overview).toBe('Overview 1');
    expect(session.preferences?.links?.github).toBe('https://github.com/user1');
    expect(session.analysis?.signature).toBe(linkSignature(session.preferences?.links));

    // the restored analysis must survive the next GET (not be treated as stale)
    const get = await app.request('/api/session/analysis', {}, env);
    const body = (await get.json()) as { analysis: any; stale?: boolean };
    expect(body.stale).toBeUndefined();
    expect(body.analysis.profile.aiSummary.overview).toBe('Overview 1');
    expect(session.analysisHistory).toHaveLength(2);
  });

  it.each([[-1], [2], [1.5], ['0'], [null]])('rejects invalid index %s with 400', async (index) => {
    const res = await post('/api/session/history/restore', { index });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid JSON body with 400', async () => {
    const res = await app.request(
      '/api/session/history/restore',
      { method: 'POST', body: 'nope' },
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/session/analysis', () => {
  it('clears the current analysis but keeps the history', async () => {
    addToHistory(session, makeAnalysis(1));
    session.analysis = session.analysisHistory?.[0];
    const res = await app.request('/api/session/analysis', { method: 'DELETE' }, env);
    expect(res.status).toBe(200);
    expect(session.analysis).toBeUndefined();
    expect(session.analysisHistory).toHaveLength(1);
  });
});
