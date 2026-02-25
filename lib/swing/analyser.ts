import type { SwingSession, SwingAnalysis } from "@/types";

const NOT_ENOUGH = "Not enough data";
const MIN_SHOTS_FOR_ANALYSIS = 5;
const MIN_SHOTS_PER_CLUB = 3;

function mostFrequent<T>(items: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  let best: T | undefined;
  let max = 0;
  for (const [item, count] of counts) {
    if (count > max) {
      max = count;
      best = item;
    }
  }
  return best;
}

interface ClubStats {
  club: string;
  totalShots: number;
  pureCount: number;
  pureRate: number;
  avgVariance: number;
  commonMiss: string;
}

function buildClubStats(sessions: SwingSession[]): ClubStats[] {
  const grouped = new Map<string, SwingSession[]>();
  for (const s of sessions) {
    const arr = grouped.get(s.club) ?? [];
    arr.push(s);
    grouped.set(s.club, arr);
  }

  const stats: ClubStats[] = [];
  for (const [club, shots] of grouped) {
    const pureCount = shots.filter((s) => s.contactQuality === "pure").length;
    const totalVariance = shots.reduce(
      (sum, s) => sum + Math.abs(s.actualDistance - s.targetDistance),
      0
    );
    const misses = shots
      .map((s) => s.shotShape)
      .filter((shape) => shape !== "straight");
    const commonMiss = mostFrequent(misses) ?? "straight";

    stats.push({
      club,
      totalShots: shots.length,
      pureCount,
      pureRate: Math.round((pureCount / shots.length) * 100),
      avgVariance: Math.round((totalVariance / shots.length) * 10) / 10,
      commonMiss,
    });
  }

  return stats;
}

export function analyseSwings(sessions: SwingSession[]): SwingAnalysis {
  const totalShots = sessions.length;

  if (totalShots === 0) {
    return {
      totalShots: 0,
      pureRate: 0,
      mostCommonMiss: NOT_ENOUGH,
      mostCommonBadContact: NOT_ENOUGH,
      bestClub: NOT_ENOUGH,
      worstClub: NOT_ENOUGH,
      avgDistanceVariance: 0,
    };
  }

  const pureCount = sessions.filter(
    (s) => s.contactQuality === "pure"
  ).length;
  const pureRate = Math.round((pureCount / totalShots) * 100);

  if (totalShots < MIN_SHOTS_FOR_ANALYSIS) {
    return {
      totalShots,
      pureRate,
      mostCommonMiss: NOT_ENOUGH,
      mostCommonBadContact: NOT_ENOUGH,
      bestClub: NOT_ENOUGH,
      worstClub: NOT_ENOUGH,
      avgDistanceVariance: 0,
    };
  }

  const misses = sessions
    .map((s) => s.shotShape)
    .filter((shape) => shape !== "straight");
  const mostCommonMiss = mostFrequent(misses) ?? "straight";

  const badContacts = sessions
    .map((s) => s.contactQuality)
    .filter((c) => c !== "pure");
  const mostCommonBadContact = mostFrequent(badContacts) ?? "pure";

  const clubStats = buildClubStats(sessions);
  const qualified = clubStats.filter(
    (c) => c.totalShots >= MIN_SHOTS_PER_CLUB
  );

  let bestClub = NOT_ENOUGH;
  let worstClub = NOT_ENOUGH;
  if (qualified.length > 0) {
    qualified.sort((a, b) => b.pureRate - a.pureRate);
    bestClub = qualified[0].club;
    worstClub = qualified[qualified.length - 1].club;
  }

  const totalVariance = sessions.reduce(
    (sum, s) => sum + Math.abs(s.actualDistance - s.targetDistance),
    0
  );
  const avgDistanceVariance =
    Math.round((totalVariance / totalShots) * 10) / 10;

  return {
    totalShots,
    pureRate,
    mostCommonMiss,
    mostCommonBadContact,
    bestClub,
    worstClub,
    avgDistanceVariance,
  };
}

export interface ClubBreakdown {
  club: string;
  totalShots: number;
  pureRate: number;
  avgVariance: number;
  commonMiss: string;
}

export function getClubBreakdown(sessions: SwingSession[]): ClubBreakdown[] {
  return buildClubStats(sessions)
    .map(({ club, totalShots, pureRate, avgVariance, commonMiss }) => ({
      club,
      totalShots,
      pureRate,
      avgVariance,
      commonMiss,
    }))
    .sort((a, b) => b.totalShots - a.totalShots);
}
