import type {
  HoleCoordinate,
  BagClub,
  SwingSession,
  WindDirection,
  WindStrength,
  Hole,
  TeeColour,
} from "@/types";
import { adjustDistance, enrichBagWithSwingData } from "@/lib/golf/distance";
import { getClubBreakdown, type ClubBreakdown } from "@/lib/swing/analyser";
import {
  getTierThresholds,
  isDriver,
  getApproachClubs,
  approachScore,
} from "@/lib/strategy/tiers";

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
  dogleg?: { lat: number; lng: number };
  dots: ShotDot[];
  totalDistance: number;
  /** Ordered polyline: tee → (dogleg?) → landing zones → green. */
  routePoints: { lat: number; lng: number }[];
}

export interface ShotPlanInput {
  holeCoord: HoleCoordinate;
  holeInfo: Hole;
  clubs: BagClub[];
  sessions: SwingSession[];
  windDir: WindDirection;
  windStr: WindStrength;
  /** Selected tee colour — used to read actual hole distances when available. */
  tee?: TeeColour;
  /** Player handicap — controls strategy aggressiveness. Defaults to 18. */
  handicap?: number;
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

/**
 * Build a visual shot plan for a single hole.
 * For dogleg holes: tee shot aims at the dogleg, remaining shots follow dogleg→green.
 * For straight holes: all shots follow tee→green bearing.
 */
export function buildVisualHolePlan(input: ShotPlanInput): VisualHolePlan {
  const { holeCoord, holeInfo, clubs, sessions, windDir, windStr, tee, handicap = 18 } = input;
  const t = getTierThresholds(handicap);
  const enriched = enrichBagWithSwingData(clubs, sessions);
  const breakdowns = getClubBreakdown(sessions);
  const sorted = [...enriched].sort((a, b) => b.distance - a.distance);

  const hasDogleg = !!holeCoord.dogleg;

  // Build route segments: tee → (waypoint?) → green
  const routeNodes: { lat: number; lng: number }[] = [holeCoord.tee];
  if (hasDogleg) routeNodes.push(holeCoord.dogleg!);
  routeNodes.push(holeCoord.green);

  const segments: { from: { lat: number; lng: number }; to: { lat: number; lng: number }; dist: number; bear: number }[] = [];
  for (let i = 0; i < routeNodes.length - 1; i++) {
    segments.push({
      from: routeNodes[i],
      to: routeNodes[i + 1],
      dist: haversine(routeNodes[i], routeNodes[i + 1]),
      bear: bearing(routeNodes[i], routeNodes[i + 1]),
    });
  }
  const haversineDist = Math.round(segments.reduce((s, seg) => s + seg.dist, 0));
  // Use actual course distance when available, fall back to haversine
  const actualDist = tee ? holeInfo.distances?.[tee] : undefined;
  const totalDistance = actualDist ?? haversineDist;

  const dots: ShotDot[] = [];

  if (enriched.length === 0) {
    return {
      hole: holeInfo.hole,
      par: holeInfo.par,
      tee: holeCoord.tee,
      green: holeCoord.green,
      dogleg: holeCoord.dogleg,
      dots: [],
      totalDistance,
      routePoints: hasDogleg
        ? [holeCoord.tee, holeCoord.dogleg!, holeCoord.green]
        : [holeCoord.tee, holeCoord.green],
    };
  }

  /**
   * Place a dot at `distFromTee` metres along the route segments.
   * Walks tee → waypoint(s) → green, following the actual fairway path.
   */
  function placeDot(distFromTee: number): { lat: number; lng: number } {
    let remaining = distFromTee;
    for (const seg of segments) {
      if (remaining <= seg.dist) {
        return moveAlongBearing(seg.from, seg.bear, remaining);
      }
      remaining -= seg.dist;
    }
    // Past final segment — extend along last segment's bearing
    const last = segments[segments.length - 1];
    return moveAlongBearing(last.from, last.bear, last.dist + remaining);
  }

  // Route is always: tee → (waypoint?) → green. No dot positions.
  const routePoints: { lat: number; lng: number }[] = hasDogleg
    ? [holeCoord.tee, holeCoord.dogleg!, holeCoord.green]
    : [holeCoord.tee, holeCoord.green];

  let cumulative = 0;

  if (holeInfo.par === 3) {
    // Par 3: tee marker + green flag only. No intermediate dots.
  } else if (holeInfo.par === 4) {
    const approachClubs = getApproachClubs(enriched, t.maxApproachDist);

    // Backward plan: pick tee shot that leaves ideal approach zone
    let teePick: BagClub | null = null;
    let teePickAdj = 0;
    let bestScore = Infinity;

    for (const teeClub of sorted) {
      const teeAdj = adjustDistance(teeClub.distance, windStr, windDir).distance;
      const rem = totalDistance - teeAdj;
      if (rem < 20) continue;

      // Rule 5: on short par 4s (<300m), skip Driver if it leaves < 60m
      if (isDriver(teeClub) && totalDistance < 300 && rem < 60) continue;

      const score = approachScore(rem, t);
      if (score < bestScore) {
        bestScore = score;
        teePick = teeClub;
        teePickAdj = teeAdj;
      }
    }

    if (teePick) {
      cumulative += teePickAdj;
      const landing = placeDot(cumulative);
      dots.push({
        label: "Tee shot",
        club: teePick.name,
        distance: teePickAdj,
        lat: landing.lat,
        lng: landing.lng,
        missWarning: getMissWarning(teePick.name, breakdowns),
      });


      const remaining = totalDistance - cumulative;
      if (remaining > 0) {
        // Rule 1/3: if remaining > max approach, layup + approach (3-shot hole)
        if (remaining > t.maxApproachDist) {
          // Backward plan: layup to leave 80-130m approach
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
            if (approachDist > t.maxApproachDist) continue;

            const s = approachScore(approachDist, t);
            if (s < bestLayupScore) {
              bestLayupScore = s;
              bestLayup = layupClub;
              bestLayupAdj = layupAdj;
              bestApproachDist = approachDist;
            }
          }

          if (bestLayup) {
            cumulative += bestLayupAdj;
            const layupLanding = placeDot(cumulative);
            dots.push({
              label: "Layup",
              club: bestLayup.name,
              distance: bestLayupAdj,
              lat: layupLanding.lat,
              lng: layupLanding.lng,
              missWarning: getMissWarning(bestLayup.name, breakdowns),
            });


            if (bestApproachDist > 10) {
              const approach = pickClubForDistance(
                bestApproachDist, approachClubs, windStr, windDir, [bestLayup.name]
              );
              if (approach) {
                cumulative += approach.adjusted;
                const approachLanding = placeDot(cumulative);
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
        } else {
          // Direct approach (2-shot par 4) — Rule 6: green-worthy clubs only
          const approach = pickClubForDistance(
            remaining, approachClubs, windStr, windDir, [teePick.name]
          );
          if (approach) {
            cumulative += approach.adjusted;
            const approachLanding = placeDot(cumulative);
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
  } else if (holeInfo.par === 5) {
    const approachClubs = getApproachClubs(enriched, t.maxApproachDist);
    // Tee shot: Driver (or longest club)
    const driverClub = enriched.find(isDriver) ?? sorted[0];
    if (driverClub) {
      const driverAdj = adjustDistance(driverClub.distance, windStr, windDir).distance;
      cumulative += driverAdj;
      const landing = placeDot(cumulative);
      dots.push({
        label: "Tee shot",
        club: driverClub.name,
        distance: driverAdj,
        lat: landing.lat,
        lng: landing.lng,
        missWarning: getMissWarning(driverClub.name, breakdowns),
      });


      const afterTee = totalDistance - cumulative;
      // Rule 4: only go for green in 2 if total under threshold AND
      // remaining is comfortably within approach range (ideal zone, not max)
      const canGoForIt =
        totalDistance < t.par5GoForItMax && afterTee <= t.idealApproachHigh;

      if (afterTee > 0 && canGoForIt) {
        // Reachable in 2 with green-worthy club
        const approach = pickClubForDistance(
          afterTee, approachClubs, windStr, windDir, [driverClub.name]
        );
        if (approach) {
          cumulative += approach.adjusted;
          const approachLanding = placeDot(cumulative);
          dots.push({
            label: "Approach",
            club: approach.club.name,
            distance: approach.adjusted,
            lat: approachLanding.lat,
            lng: approachLanding.lng,
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
          if (approachDist > t.maxApproachDist) continue;

          const score = approachScore(approachDist, t);
          if (score < bestScore) {
            bestScore = score;
            bestLayup = layupClub;
            bestLayupAdj = layupAdj;
            bestApproachDist = approachDist;
          }
        }

        if (bestLayup) {
          cumulative += bestLayupAdj;
          const layupLanding = placeDot(cumulative);
          dots.push({
            label: "Second shot",
            club: bestLayup.name,
            distance: bestLayupAdj,
            lat: layupLanding.lat,
            lng: layupLanding.lng,
            missWarning: getMissWarning(bestLayup.name, breakdowns),
          });

          if (bestApproachDist > 10) {
            const approach = pickClubForDistance(
              bestApproachDist, approachClubs, windStr, windDir, [bestLayup.name]
            );
            if (approach) {
              cumulative += approach.adjusted;
              const approachLanding = placeDot(cumulative);
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
  }

  // No 30m skip — HoleMapPreview's 85% proportional cap prevents
  // dots from overlapping the green flag visually.

  return {
    hole: holeInfo.hole,
    par: holeInfo.par,
    tee: holeCoord.tee,
    green: holeCoord.green,
    dogleg: holeCoord.dogleg,
    dots,
    totalDistance,
    routePoints,
  };
}
