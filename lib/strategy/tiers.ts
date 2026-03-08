import type { BagClub } from "@/types";

// ── Types ────────────────────────────────────────────────────────────

export type HandicapTier = "LOW" | "MID" | "HIGH";

export interface TierThresholds {
  tier: HandicapTier;
  /** Max bag distance for an approach into the green. */
  maxApproachDist: number;
  /** Par 5: only go for green in 2 if total distance is under this. */
  par5GoForItMax: number;
  /** Ideal approach centre (scoring target). */
  idealApproach: number;
  /** Ideal approach zone — lower bound. */
  idealApproachLow: number;
  /** Ideal approach zone — upper bound. */
  idealApproachHigh: number;
}

// ── Tier configs ─────────────────────────────────────────────────────

const LOW: TierThresholds = {
  tier: "LOW",
  maxApproachDist: 200,
  par5GoForItMax: 500,
  idealApproach: 125,
  idealApproachLow: 100,
  idealApproachHigh: 150,
};

const MID: TierThresholds = {
  tier: "MID",
  maxApproachDist: 170,
  par5GoForItMax: 420,
  idealApproach: 105,
  idealApproachLow: 80,
  idealApproachHigh: 130,
};

const HIGH: TierThresholds = {
  tier: "HIGH",
  maxApproachDist: 150,
  par5GoForItMax: 380,
  idealApproach: 90,
  idealApproachLow: 70,
  idealApproachHigh: 110,
};

// ── Tier resolution ──────────────────────────────────────────────────

export function getHandicapTier(handicap: number): HandicapTier {
  if (handicap <= 10) return "LOW";
  if (handicap <= 20) return "MID";
  return "HIGH";
}

export function getTierThresholds(handicap: number): TierThresholds {
  const tier = getHandicapTier(handicap);
  switch (tier) {
    case "LOW":
      return LOW;
    case "MID":
      return MID;
    case "HIGH":
      return HIGH;
  }
}

// ── Shared helpers ───────────────────────────────────────────────────

export function isDriver(club: BagClub): boolean {
  return club.name.toLowerCase() === "driver";
}

export function is3Wood(club: BagClub): boolean {
  return club.name.toLowerCase() === "3 wood";
}

/** Clubs eligible for approach shots into the green. Never Driver or 3 Wood. */
export function getApproachClubs(
  clubs: BagClub[],
  maxApproachDist: number
): BagClub[] {
  return clubs.filter(
    (c) => c.distance <= maxApproachDist && !isDriver(c) && !is3Wood(c)
  );
}

/** Score a candidate approach distance. Lower is better. +30 penalty outside ideal zone. */
export function approachScore(
  approachDist: number,
  t: TierThresholds
): number {
  return (
    Math.abs(approachDist - t.idealApproach) +
    (approachDist >= t.idealApproachLow && approachDist <= t.idealApproachHigh
      ? 0
      : 30)
  );
}
