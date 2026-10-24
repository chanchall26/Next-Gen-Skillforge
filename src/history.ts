import type { DashboardSessionData, StoredAnalysis } from './types';
import { isUserProfile } from './validate';

export const MAX_HISTORY = 10;

// Each entry keeps its full profile so it can be restored. Profiles are a few
// KB each, so ten of them stay far below the KV value and D1 row limits; this
// cap is only a safety net against unusually large profiles.
const MAX_HISTORY_BYTES = 1_000_000;

/** Adds an analysis to the front of the history (newest first, max 10). */
export function addToHistory(session: DashboardSessionData, analysis: StoredAnalysis): void {
  const history = [analysis, ...(session.analysisHistory ?? [])].slice(0, MAX_HISTORY);
  while (
    history.length > 0 &&
    new TextEncoder().encode(JSON.stringify(history)).byteLength > MAX_HISTORY_BYTES
  ) {
    history.pop();
  }
  session.analysisHistory = history;
}

type ProfileShape = {
  aiSummary: { overview: string; atsScore: number; industryRelevanceScore: number };
  jobRecommendations: unknown[];
};

export interface HistorySummary {
  index: number;
  createdAt: string | null;
  signature: string;
  overview: string;
  atsScore: number | null;
  industryRelevanceScore: number | null;
  jobMatches: number;
  current: boolean;
}

/** Light-weight list of the history, without the full profiles. */
export function summarizeHistory(session: DashboardSessionData): HistorySummary[] {
  const current = session.analysis;
  return (session.analysisHistory ?? []).map((entry, index) => {
    const profile = isUserProfile(entry.profile) ? (entry.profile as ProfileShape) : null;
    const overview = profile?.aiSummary.overview ?? '';
    return {
      index,
      createdAt: entry.createdAt ?? null,
      signature: entry.signature,
      overview: overview.length > 160 ? `${overview.slice(0, 157)}...` : overview,
      atsScore: profile?.aiSummary.atsScore ?? null,
      industryRelevanceScore: profile?.aiSummary.industryRelevanceScore ?? null,
      jobMatches: profile?.jobRecommendations.length ?? 0,
      current: !!current?.createdAt && current.createdAt === entry.createdAt,
    };
  });
}
