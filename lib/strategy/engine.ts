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
  windDir: WindDirection
): { club: BagClub; adjusted: number } | null {
  if (clubs.length === 0) return null;

  let best: BagClub | null = null;
  let bestAdj = 0;
  let bestDiff = Infinity;

  for (const c of clubs) {
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
  const enriched = enrichBagWithSwingData(clubs, sessions);
  const breakdowns = getClubBreakdown(sessions);

  // Sort clubs by distance descending for shot planning
  const sorted = [...enriched].sort((a, b) => b.distance - a.distance);
  const driver = sorted[0] ?? null;
  const longestNonDriver = sorted[1] ?? null;

  const holes: HoleStrategy[] = course.holes.map((hole) => {
    const strokes = hcpStrokesOnHole(chcp, hole.si);
    const targetScore = hole.par + strokes;
    const notes = buildNotes(hole.si, strokes);
    const totalDist = PAR_DISTANCES[hole.par] ?? 365;

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
      // Par 4: driver off the tee, approach with remaining
      if (driver) {
        const driverAdj = adjustDistance(driver.distance, windStr, windDir).distance;
        shots.push({
          label: "Tee shot",
          club: driver.name,
          distance: driverAdj,
          missWarning: getMissWarning(driver.name, breakdowns),
        });

        const remaining = totalDist - driverAdj;
        if (remaining > 0) {
          const approach = pickClubForDistance(remaining, enriched, windStr, windDir);
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
    } else if (hole.par === 5) {
      // Par 5: driver + second + approach
      if (driver) {
        const driverAdj = adjustDistance(driver.distance, windStr, windDir).distance;
        shots.push({
          label: "Tee shot",
          club: driver.name,
          distance: driverAdj,
          missWarning: getMissWarning(driver.name, breakdowns),
        });

        // Check if reachable in 2
        if (longestNonDriver) {
          const secondAdj = adjustDistance(longestNonDriver.distance, windStr, windDir).distance;
          if (driverAdj + secondAdj >= totalDist) {
            goForIt = true;
          }
        }

        const afterTee = totalDist - driverAdj;
        if (afterTee > 0 && longestNonDriver) {
          const secondAdj = adjustDistance(longestNonDriver.distance, windStr, windDir).distance;
          shots.push({
            label: "Second shot",
            club: longestNonDriver.name,
            distance: secondAdj,
            missWarning: getMissWarning(longestNonDriver.name, breakdowns),
          });

          const remaining = afterTee - secondAdj;
          if (remaining > 0) {
            const approach = pickClubForDistance(remaining, enriched, windStr, windDir);
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
    holes,
  };
}
