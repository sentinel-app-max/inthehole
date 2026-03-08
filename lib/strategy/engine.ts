import type {
  Course,
  TeeColour,
  BagClub,
  SwingSession,
  WindDirection,
  WindStrength,
} from "@/types";
import { courseHcp, hcpStrokesOnHole } from "@/lib/scoring/engine";
import { adjustDistance, enrichBagWithSwingData } from "@/lib/golf/distance";
import { getClubBreakdown, type ClubBreakdown } from "@/lib/swing/analyser";
import {
  getTierThresholds,
  isDriver,
  getApproachClubs,
  approachScore,
  type HandicapTier,
} from "@/lib/strategy/tiers";

// ── Par-based distance estimates (metres) ───────────────────────────

const PAR_DISTANCES: Record<number, number> = {
  3: 155,
  4: 365,
  5: 480,
};

// ── Types ────────────────────────────────────────────────────────────

export interface ShotPlan {
  label: string;
  club: string;
  distance: number;
  missWarning: string | null;
}

export interface HoleStrategy {
  hole: number;
  par: number;
  si: number;
  strokes: number;
  targetScore: number;
  shots: ShotPlan[];
  goForIt: boolean;
  notes: string;
}

export interface CourseStrategy {
  courseName: string;
  tee: TeeColour;
  courseHcp: number;
  tier: HandicapTier;
  holes: HoleStrategy[];
}

export interface StrategyInput {
  course: Course;
  tee: TeeColour;
  handicap: number;
  clubs: BagClub[];
  sessions: SwingSession[];
  windDir: WindDirection;
  windStr: WindStrength;
}

// ── Helpers ──────────────────────────────────────────────────────────

function getMissWarning(
  clubName: string,
  breakdowns: ClubBreakdown[]
): string | null {
  const bd = breakdowns.find((b) => b.club === clubName);
  if (!bd || bd.totalShots < 3 || bd.commonMiss === "straight") return null;
  return `tends to ${bd.commonMiss}`;
}

function pickClubForDistance(
  target: number,
  clubs: BagClub[],
  windStr: WindStrength,
  windDir: WindDirection,
  excludeNames: string[] = []
): { club: BagClub; adjusted: number } | null {
  const available =
    excludeNames.length > 0
      ? clubs.filter((c) => !excludeNames.includes(c.name))
      : clubs;
  if (available.length === 0) return null;

  let best: BagClub | null = null;
  let bestAdj = 0;
  let bestDiff = Infinity;

  for (const c of available) {
    const adj = adjustDistance(c.distance, windStr, windDir).distance;
    const diff = Math.abs(adj - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = c;
      bestAdj = adj;
    }
  }

  return best ? { club: best, adjusted: bestAdj } : null;
}

function buildNotes(si: number, strokes: number): string {
  const parts: string[] = [];
  if (si <= 3) parts.push("One of the hardest holes");
  if (si >= 16) parts.push("Good birdie chance");
  if (strokes > 0) {
    parts.push(`You get ${strokes} stroke${strokes > 1 ? "s" : ""} here`);
  }
  return parts.join(". ");
}

// ── Main Engine ──────────────────────────────────────────────────────

export function buildStrategy(input: StrategyInput): CourseStrategy {
  const { course, tee, handicap, clubs, sessions, windDir, windStr } = input;

  const teeDatum =
    course.tees.find((t) => t.colour === tee) ??
    course.tees.find((t) => t.colour === "white") ??
    { colour: "white" as TeeColour, cr: course.rating, slope: course.slope };

  const chcp = courseHcp(handicap, teeDatum.slope, teeDatum.cr, course.par);
  const th = getTierThresholds(handicap);
  const enriched = enrichBagWithSwingData(clubs, sessions);
  const breakdowns = getClubBreakdown(sessions);

  // Sort clubs by distance descending for shot planning
  const sorted = [...enriched].sort((a, b) => b.distance - a.distance);

  const holes: HoleStrategy[] = course.holes.map((hole) => {
    const strokes = hcpStrokesOnHole(chcp, hole.si);
    const targetScore = hole.par + strokes;
    const notes = buildNotes(hole.si, strokes);
    const totalDist = hole.distances?.[tee] ?? PAR_DISTANCES[hole.par] ?? 365;

    if (enriched.length === 0) {
      return {
        hole: hole.hole,
        par: hole.par,
        si: hole.si,
        strokes,
        targetScore,
        shots: [],
        goForIt: false,
        notes,
      };
    }

    const shots: ShotPlan[] = [];
    let goForIt = false;

    if (hole.par === 3) {
      // Par 3: one shot to the green
      const pick = pickClubForDistance(totalDist, enriched, windStr, windDir);
      if (pick) {
        shots.push({
          label: "Tee shot",
          club: pick.club.name,
          distance: pick.adjusted,
          missWarning: getMissWarning(pick.club.name, breakdowns),
        });
      }
    } else if (hole.par === 4) {
      const approachClubs = getApproachClubs(enriched, th.maxApproachDist);

      // Backward plan: pick tee shot that leaves ideal approach zone
      let teePick: BagClub | null = null;
      let teePickAdj = 0;
      let bestScore = Infinity;

      for (const teeClub of sorted) {
        const teeAdj = adjustDistance(teeClub.distance, windStr, windDir).distance;
        const rem = totalDist - teeAdj;
        if (rem < 20) continue;

        // Rule 5: on short par 4s (<300m), skip Driver if it leaves < 60m
        if (isDriver(teeClub) && totalDist < 300 && rem < 60) continue;

        const score = approachScore(rem, th);
        if (score < bestScore) {
          bestScore = score;
          teePick = teeClub;
          teePickAdj = teeAdj;
        }
      }

      if (teePick) {
        shots.push({
          label: "Tee shot",
          club: teePick.name,
          distance: teePickAdj,
          missWarning: getMissWarning(teePick.name, breakdowns),
        });

        const remaining = totalDist - teePickAdj;
        if (remaining > 0) {
          // Rule 1/3: if remaining > max approach, layup + approach (3-shot hole)
          if (remaining > th.maxApproachDist) {
            // Backward plan: layup to leave ideal approach
            let bestLayup: BagClub | null = null;
            let bestLayupAdj = 0;
            let bestApproachDist = 0;
            let bestLayupScore = Infinity;

            // Exclude tee club and Driver from layup (3 Wood is a valid layup club)
            const layupCandidates = enriched.filter(
              (c) => c.name !== teePick!.name && !isDriver(c)
            );

            for (const layupClub of layupCandidates) {
              const layupAdj = adjustDistance(layupClub.distance, windStr, windDir).distance;
              const approachDist = remaining - layupAdj;
              if (approachDist < 20) continue;
              if (approachDist > th.maxApproachDist) continue;

              const s = approachScore(approachDist, th);
              if (s < bestLayupScore) {
                bestLayupScore = s;
                bestLayup = layupClub;
                bestLayupAdj = layupAdj;
                bestApproachDist = approachDist;
              }
            }

            if (bestLayup) {
              shots.push({
                label: "Layup",
                club: bestLayup.name,
                distance: bestLayupAdj,
                missWarning: getMissWarning(bestLayup.name, breakdowns),
              });

              if (bestApproachDist > 10) {
                const approach = pickClubForDistance(
                  bestApproachDist, approachClubs, windStr, windDir, [bestLayup.name]
                );
                if (approach) {
                  shots.push({
                    label: "Approach",
                    club: approach.club.name,
                    distance: approach.adjusted,
                    missWarning: getMissWarning(approach.club.name, breakdowns),
                  });
                }
              }
            }
          } else {
            // Direct approach (2-shot par 4) — Rule 6: green-worthy clubs only
            const approach = pickClubForDistance(
              remaining, approachClubs, windStr, windDir, [teePick.name]
            );
            if (approach) {
              shots.push({
                label: "Approach",
                club: approach.club.name,
                distance: approach.adjusted,
                missWarning: getMissWarning(approach.club.name, breakdowns),
              });
            }
          }
        }
      }
    } else if (hole.par === 5) {
      const approachClubs = getApproachClubs(enriched, th.maxApproachDist);
      // Tee shot: Driver (or longest club)
      const driverClub = enriched.find(isDriver) ?? sorted[0];
      if (driverClub) {
        const driverAdj = adjustDistance(driverClub.distance, windStr, windDir).distance;
        const afterTee = totalDist - driverAdj;

        // Rule 4: only go for green in 2 if total under threshold AND approach within max
        const canGoForIt =
          totalDist < th.par5GoForItMax && afterTee <= th.maxApproachDist;
        if (canGoForIt) goForIt = true;

        shots.push({
          label: "Tee shot",
          club: driverClub.name,
          distance: driverAdj,
          missWarning: getMissWarning(driverClub.name, breakdowns),
        });

        if (afterTee > 0 && canGoForIt) {
          // Reachable in 2 with green-worthy club
          const approach = pickClubForDistance(
            afterTee, approachClubs, windStr, windDir, [driverClub.name]
          );
          if (approach) {
            shots.push({
              label: "Approach",
              club: approach.club.name,
              distance: approach.adjusted,
              missWarning: getMissWarning(approach.club.name, breakdowns),
            });
          }
        } else if (afterTee > 0) {
          // 3-shot plan: layup + approach backward from green
          // Exclude Driver from layup (3 Wood is a valid layup club)
          const layupCandidates = sorted.filter((c) => !isDriver(c));
          let bestLayup: BagClub | null = null;
          let bestLayupAdj = 0;
          let bestApproachDist = 0;
          let bestScore = Infinity;

          for (const layupClub of layupCandidates) {
            const layupAdj = adjustDistance(layupClub.distance, windStr, windDir).distance;
            const approachDist = afterTee - layupAdj;
            if (approachDist < 20) continue;
            if (approachDist > th.maxApproachDist) continue;

            const score = approachScore(approachDist, th);
            if (score < bestScore) {
              bestScore = score;
              bestLayup = layupClub;
              bestLayupAdj = layupAdj;
              bestApproachDist = approachDist;
            }
          }

          if (bestLayup) {
            shots.push({
              label: "Second shot",
              club: bestLayup.name,
              distance: bestLayupAdj,
              missWarning: getMissWarning(bestLayup.name, breakdowns),
            });

            if (bestApproachDist > 10) {
              const approach = pickClubForDistance(
                bestApproachDist, approachClubs, windStr, windDir, [bestLayup.name]
              );
              if (approach) {
                shots.push({
                  label: "Approach",
                  club: approach.club.name,
                  distance: approach.adjusted,
                  missWarning: getMissWarning(approach.club.name, breakdowns),
                });
              }
            }
          }
        }
      }
    }

    return {
      hole: hole.hole,
      par: hole.par,
      si: hole.si,
      strokes,
      targetScore,
      shots,
      goForIt,
      notes,
    };
  });

  return {
    courseName: course.name,
    tee,
    courseHcp: chcp,
    tier: th.tier,
    holes,
  };
}
