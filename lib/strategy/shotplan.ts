import type {
  HoleCoordinate,
  BagClub,
  SwingSession,
  WindDirection,
  WindStrength,
  Hole,
} from "@/types";
import { adjustDistance, enrichBagWithSwingData } from "@/lib/golf/distance";
import { getClubBreakdown, type ClubBreakdown } from "@/lib/swing/analyser";

// ── Types ────────────────────────────────────────────────────────────

export interface ShotDot {
  label: string;
  club: string;
  distance: number;
  lat: number;
  lng: number;
  missWarning: string | null;
}

export interface VisualHolePlan {
  hole: number;
  par: number;
  tee: { lat: number; lng: number };
  green: { lat: number; lng: number };
  dots: ShotDot[];
  totalDistance: number;
}

export interface ShotPlanInput {
  holeCoord: HoleCoordinate;
  holeInfo: Hole;
  clubs: BagClub[];
  sessions: SwingSession[];
  windDir: WindDirection;
  windStr: WindStrength;
}

// ── Geometry helpers ─────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Haversine distance in metres. */
export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Bearing in radians from a to b. */
export function bearing(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.atan2(y, x);
}

/**
 * Move `distanceM` metres from `origin` along `bearingRad`.
 * Returns new lat/lng.
 */
export function moveAlongBearing(
  origin: { lat: number; lng: number },
  bearingRad: number,
  distanceM: number
): { lat: number; lng: number } {
  const δ = distanceM / EARTH_RADIUS_M;
  const φ1 = toRad(origin.lat);
  const λ1 = toRad(origin.lng);

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) +
      Math.cos(φ1) * Math.sin(δ) * Math.cos(bearingRad)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

  return { lat: toDeg(φ2), lng: toDeg(λ2) };
}

// ── Shot planner ─────────────────────────────────────────────────────

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

/**
 * Build a visual shot plan for a single hole.
 * Places landing-zone dots along the tee→green bearing at expected carry distances.
 */
export function buildVisualHolePlan(input: ShotPlanInput): VisualHolePlan {
  const { holeCoord, holeInfo, clubs, sessions, windDir, windStr } = input;
  const enriched = enrichBagWithSwingData(clubs, sessions);
  const breakdowns = getClubBreakdown(sessions);
  const sorted = [...enriched].sort((a, b) => b.distance - a.distance);
  const driver = sorted[0] ?? null;
  const longestNonDriver = sorted[1] ?? null;

  const teeToGreenBearing = bearing(holeCoord.tee, holeCoord.green);
  const totalDistance = Math.round(haversine(holeCoord.tee, holeCoord.green));

  const dots: ShotDot[] = [];

  if (enriched.length === 0) {
    return {
      hole: holeInfo.hole,
      par: holeInfo.par,
      tee: holeCoord.tee,
      green: holeCoord.green,
      dots: [],
      totalDistance,
    };
  }

  let cumulative = 0;

  if (holeInfo.par === 3) {
    const pick = pickClubForDistance(totalDistance, enriched, windStr, windDir);
    if (pick) {
      const landing = moveAlongBearing(
        holeCoord.tee,
        teeToGreenBearing,
        pick.adjusted
      );
      dots.push({
        label: "Tee shot",
        club: pick.club.name,
        distance: pick.adjusted,
        lat: landing.lat,
        lng: landing.lng,
        missWarning: getMissWarning(pick.club.name, breakdowns),
      });
    }
  } else if (holeInfo.par === 4) {
    if (driver) {
      const driverAdj = adjustDistance(
        driver.distance,
        windStr,
        windDir
      ).distance;
      cumulative += driverAdj;
      const landing = moveAlongBearing(
        holeCoord.tee,
        teeToGreenBearing,
        cumulative
      );
      dots.push({
        label: "Tee shot",
        club: driver.name,
        distance: driverAdj,
        lat: landing.lat,
        lng: landing.lng,
        missWarning: getMissWarning(driver.name, breakdowns),
      });

      const remaining = totalDistance - cumulative;
      if (remaining > 0) {
        const approach = pickClubForDistance(
          remaining,
          enriched,
          windStr,
          windDir
        );
        if (approach) {
          cumulative += approach.adjusted;
          const approachLanding = moveAlongBearing(
            holeCoord.tee,
            teeToGreenBearing,
            cumulative
          );
          dots.push({
            label: "Approach",
            club: approach.club.name,
            distance: approach.adjusted,
            lat: approachLanding.lat,
            lng: approachLanding.lng,
            missWarning: getMissWarning(approach.club.name, breakdowns),
          });
        }
      }
    }
  } else if (holeInfo.par === 5) {
    if (driver) {
      const driverAdj = adjustDistance(
        driver.distance,
        windStr,
        windDir
      ).distance;
      cumulative += driverAdj;
      const landing = moveAlongBearing(
        holeCoord.tee,
        teeToGreenBearing,
        cumulative
      );
      dots.push({
        label: "Tee shot",
        club: driver.name,
        distance: driverAdj,
        lat: landing.lat,
        lng: landing.lng,
        missWarning: getMissWarning(driver.name, breakdowns),
      });

      const afterTee = totalDistance - cumulative;
      if (afterTee > 0 && longestNonDriver) {
        const secondAdj = adjustDistance(
          longestNonDriver.distance,
          windStr,
          windDir
        ).distance;
        cumulative += secondAdj;
        const secondLanding = moveAlongBearing(
          holeCoord.tee,
          teeToGreenBearing,
          cumulative
        );
        dots.push({
          label: "Second shot",
          club: longestNonDriver.name,
          distance: secondAdj,
          lat: secondLanding.lat,
          lng: secondLanding.lng,
          missWarning: getMissWarning(longestNonDriver.name, breakdowns),
        });

        const remaining = totalDistance - cumulative;
        if (remaining > 0) {
          const approach = pickClubForDistance(
            remaining,
            enriched,
            windStr,
            windDir
          );
          if (approach) {
            cumulative += approach.adjusted;
            const approachLanding = moveAlongBearing(
              holeCoord.tee,
              teeToGreenBearing,
              cumulative
            );
            dots.push({
              label: "Approach",
              club: approach.club.name,
              distance: approach.adjusted,
              lat: approachLanding.lat,
              lng: approachLanding.lng,
              missWarning: getMissWarning(approach.club.name, breakdowns),
            });
          }
        }
      }
    }
  }

  return {
    hole: holeInfo.hole,
    par: holeInfo.par,
    tee: holeCoord.tee,
    green: holeCoord.green,
    dots,
    totalDistance,
  };
}
