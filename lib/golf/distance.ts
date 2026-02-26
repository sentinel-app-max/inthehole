import type { BagClub, WindDirection, WindStrength, SwingSession } from "@/types";

// ── Haversine Distance ──────────────────────────────────────────────

interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance between two points. Returns metres, rounded. */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_M * c);
}

// ── Wind Adjustment ─────────────────────────────────────────────────

export function getWindEffect(
  wind: WindDirection
): "head" | "tail" | "cross" {
  if (wind === "N") return "head";
  if (wind === "S") return "tail";
  return "cross";
}

export interface WindAdjustment {
  distance: number;
  type: "head" | "tail" | "cross" | "calm";
}

export function adjustDistance(
  base: number,
  strength: WindStrength,
  wind: WindDirection
): WindAdjustment {
  if (strength === "calm") return { distance: base, type: "calm" };

  const effect = getWindEffect(wind);
  if (effect === "cross") return { distance: base, type: "cross" };

  const headPct: Record<string, number> = { light: 0.05, moderate: 0.10, strong: 0.15 };
  const tailPct: Record<string, number> = { light: 0.05, moderate: 0.08, strong: 0.12 };

  if (effect === "head") {
    return { distance: Math.round(base * (1 - headPct[strength])), type: "head" };
  }
  return { distance: Math.round(base * (1 + tailPct[strength])), type: "tail" };
}

// ── Club Recommendation ─────────────────────────────────────────────

export interface Recommendation {
  primary: { name: string; base: number; adjusted: number };
  secondary?: { name: string; base: number; adjusted: number };
  between: boolean;
  message: string;
}

export function recommendClub(
  target: number,
  clubs: BagClub[],
  strength: WindStrength,
  wind: WindDirection
): Recommendation | null {
  if (clubs.length === 0) return null;

  const adjusted = clubs.map((c) => ({
    ...c,
    adjusted: adjustDistance(c.distance, strength, wind).distance,
  }));

  const sorted = [...adjusted].sort(
    (a, b) => Math.abs(a.adjusted - target) - Math.abs(b.adjusted - target)
  );

  const best = sorted[0];
  const diff = Math.abs(best.adjusted - target);

  if (diff <= 5) {
    return {
      primary: { name: best.name, base: best.distance, adjusted: best.adjusted },
      between: false,
      message: "Perfect club for this shot",
    };
  }

  if (sorted.length >= 2) {
    const second = sorted[1];
    const bestOver = best.adjusted >= target;
    const secondOver = second.adjusted >= target;

    if (bestOver !== secondOver) {
      const shorter = best.adjusted < second.adjusted ? best : second;
      const longer = best.adjusted < second.adjusted ? second : best;
      return {
        primary: { name: shorter.name, base: shorter.distance, adjusted: shorter.adjusted },
        secondary: { name: longer.name, base: longer.distance, adjusted: longer.adjusted },
        between: true,
        message: `Between ${shorter.name} (${shorter.adjusted}m) and ${longer.name} (${longer.adjusted}m) \u2014 take ${shorter.name} and swing full`,
      };
    }
  }

  return {
    primary: { name: best.name, base: best.distance, adjusted: best.adjusted },
    between: false,
    message: best.adjusted > target ? "Ease off a touch" : "Give it a bit extra",
  };
}

// ── Swing-Enriched Bag ──────────────────────────────────────────────

const MIN_SHOTS_FOR_ACTUAL = 5;

/** Replace bag distances with actual averages when 5+ shots exist for a club. */
export function enrichBagWithSwingData(
  clubs: BagClub[],
  sessions: SwingSession[]
): BagClub[] {
  const byClub = new Map<string, SwingSession[]>();
  for (const s of sessions) {
    const arr = byClub.get(s.club) ?? [];
    arr.push(s);
    byClub.set(s.club, arr);
  }

  return clubs.map((club) => {
    const clubSessions = byClub.get(club.name);
    if (!clubSessions || clubSessions.length < MIN_SHOTS_FOR_ACTUAL) {
      return club;
    }
    const avgActual = Math.round(
      clubSessions.reduce((sum, s) => sum + s.actualDistance, 0) / clubSessions.length
    );
    return { ...club, distance: avgActual };
  });
}
