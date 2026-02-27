import {
  buildVisualHolePlan,
  haversine,
  bearing,
  moveAlongBearing,
  type ShotPlanInput,
} from "../lib/strategy/shotplan";
import type { HoleCoordinate, BagClub, Hole } from "../types";

// ── Test data ───────────────────────────────────────────────────────

const TEE: HoleCoordinate["tee"] = { lat: -26.0567, lng: 27.9206 };
// ~520m north of tee (par 5)
const GREEN_PAR5: HoleCoordinate["green"] = { lat: -26.0520, lng: 27.9206 };
// ~370m north of tee (par 4)
const GREEN_PAR4: HoleCoordinate["green"] = { lat: -26.0534, lng: 27.9206 };
// ~155m north of tee (par 3)
const GREEN_PAR3: HoleCoordinate["green"] = { lat: -26.0553, lng: 27.9206 };

const TEST_BAG: BagClub[] = [
  { name: "Driver", distance: 230 },
  { name: "3 Wood", distance: 200 },
  { name: "5 Iron", distance: 170 },
  { name: "7 Iron", distance: 150 },
  { name: "9 Iron", distance: 120 },
  { name: "PW", distance: 100 },
  { name: "SW", distance: 80 },
];

function makeInput(
  par: number,
  green: { lat: number; lng: number },
  clubs: BagClub[] = TEST_BAG
): ShotPlanInput {
  const holeCoord: HoleCoordinate = { hole: 1, tee: TEE, green };
  const holeInfo: Hole = { hole: 1, par, si: 5 };
  return {
    holeCoord,
    holeInfo,
    clubs,
    sessions: [],
    windDir: "N",
    windStr: "calm",
  };
}

// ── Geometry tests ──────────────────────────────────────────────────

describe("haversine", () => {
  it("returns ~0 for same point", () => {
    expect(haversine(TEE, TEE)).toBeLessThan(1);
  });

  it("returns reasonable distance for known points", () => {
    // ~520m between tee and par-5 green (0.0047° lat ≈ 523m)
    const dist = haversine(TEE, GREEN_PAR5);
    expect(dist).toBeGreaterThan(400);
    expect(dist).toBeLessThan(600);
  });
});

describe("bearing", () => {
  it("returns ~0 (north) for point directly north", () => {
    const b = bearing(TEE, { lat: TEE.lat + 0.01, lng: TEE.lng });
    // Should be close to 0 radians (north)
    expect(Math.abs(b)).toBeLessThan(0.01);
  });

  it("returns ~π/2 (east) for point directly east", () => {
    const b = bearing(TEE, { lat: TEE.lat, lng: TEE.lng + 0.01 });
    expect(b).toBeGreaterThan(1.5);
    expect(b).toBeLessThan(1.6);
  });
});

describe("moveAlongBearing", () => {
  it("moves north by expected distance", () => {
    const result = moveAlongBearing(TEE, 0, 500);
    // Should be ~500m north
    const dist = haversine(TEE, result);
    expect(dist).toBeGreaterThan(490);
    expect(dist).toBeLessThan(510);
  });

  it("preserves longitude when moving due north", () => {
    const result = moveAlongBearing(TEE, 0, 500);
    expect(result.lng).toBeCloseTo(TEE.lng, 4);
    expect(result.lat).toBeGreaterThan(TEE.lat);
  });

  it("preserves latitude when moving due east", () => {
    const result = moveAlongBearing(TEE, Math.PI / 2, 500);
    expect(result.lat).toBeCloseTo(TEE.lat, 4);
    expect(result.lng).toBeGreaterThan(TEE.lng);
  });
});

// ── Shot plan tests ─────────────────────────────────────────────────

describe("buildVisualHolePlan", () => {
  it("par 3 returns 1 dot", () => {
    const plan = buildVisualHolePlan(makeInput(3, GREEN_PAR3));
    expect(plan.dots).toHaveLength(1);
    expect(plan.dots[0].label).toBe("Tee shot");
    expect(plan.par).toBe(3);
  });

  it("par 4 returns 2 dots (tee + approach)", () => {
    const plan = buildVisualHolePlan(makeInput(4, GREEN_PAR4));
    expect(plan.dots).toHaveLength(2);
    expect(plan.dots[0].label).toBe("Tee shot");
    expect(plan.dots[0].club).toBe("Driver");
    expect(plan.dots[1].label).toBe("Approach");
  });

  it("par 5 returns 3 dots (tee + second + approach)", () => {
    const plan = buildVisualHolePlan(makeInput(5, GREEN_PAR5));
    expect(plan.dots).toHaveLength(3);
    expect(plan.dots[0].label).toBe("Tee shot");
    expect(plan.dots[1].label).toBe("Second shot");
    expect(plan.dots[2].label).toBe("Approach");
  });

  it("empty bag returns 0 dots", () => {
    const plan = buildVisualHolePlan(makeInput(4, GREEN_PAR4, []));
    expect(plan.dots).toHaveLength(0);
    expect(plan.totalDistance).toBeGreaterThan(0);
  });

  it("landing zones are along tee-to-green bearing", () => {
    const plan = buildVisualHolePlan(makeInput(4, GREEN_PAR4));
    // All dots should be between tee and green latitude-wise
    // (since green is north of tee, dots should have lat between tee and green)
    for (const dot of plan.dots) {
      expect(dot.lat).toBeGreaterThanOrEqual(TEE.lat);
    }
  });

  it("cumulative dot distances place dots progressively further from tee", () => {
    const plan = buildVisualHolePlan(makeInput(5, GREEN_PAR5));
    if (plan.dots.length < 2) return;
    for (let i = 1; i < plan.dots.length; i++) {
      const prevDist = haversine(TEE, {
        lat: plan.dots[i - 1].lat,
        lng: plan.dots[i - 1].lng,
      });
      const curDist = haversine(TEE, {
        lat: plan.dots[i].lat,
        lng: plan.dots[i].lng,
      });
      expect(curDist).toBeGreaterThan(prevDist);
    }
  });

  it("totalDistance is reasonable for the hole", () => {
    const plan = buildVisualHolePlan(makeInput(4, GREEN_PAR4));
    expect(plan.totalDistance).toBeGreaterThan(300);
    expect(plan.totalDistance).toBeLessThan(500);
  });

  it("each dot has a club name and distance", () => {
    const plan = buildVisualHolePlan(makeInput(4, GREEN_PAR4));
    for (const dot of plan.dots) {
      expect(dot.club).toBeTruthy();
      expect(dot.distance).toBeGreaterThan(0);
    }
  });
});
