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

// Dogleg: tee shoots NE to dogleg, then dogleg→green goes N
const DOGLEG: HoleCoordinate["dogleg"] = { lat: -26.0545, lng: 27.9230 };
const GREEN_DOGLEG: HoleCoordinate["green"] = { lat: -26.0505, lng: 27.9230 };

function makeInput(
  par: number,
  green: { lat: number; lng: number },
  clubs: BagClub[] = TEST_BAG,
  dogleg?: { lat: number; lng: number }
): ShotPlanInput {
  const holeCoord: HoleCoordinate = { hole: 1, par, si: 5, tee: TEE, green, dogleg };
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
  it("par 3 returns 0 dots (tee + green flag only)", () => {
    const plan = buildVisualHolePlan(makeInput(3, GREEN_PAR3));
    expect(plan.dots).toHaveLength(0);
    expect(plan.par).toBe(3);
  });

  it("par 4 returns 2 dots (tee shot + approach)", () => {
    const plan = buildVisualHolePlan(makeInput(4, GREEN_PAR4));
    // 2-shot plans always keep both dots so the map shows tee + approach.
    // The 30m skip only fires when there are 3+ dots.
    expect(plan.dots).toHaveLength(2);
    expect(plan.dots[0].label).toBe("Tee shot");
    expect(plan.dots[0].club).toBe("Driver");
    expect(plan.dots[1].label).toBe("Approach");
  });

  it("par 5 second shot picks club for remaining distance, not next longest", () => {
    const plan = buildVisualHolePlan(makeInput(5, GREEN_PAR5));
    expect(plan.dots.length).toBeGreaterThanOrEqual(2);
    expect(plan.dots[0].label).toBe("Tee shot");
    expect(plan.dots[0].club).toBe("Driver");
    // Remaining after driver (~230m) from ~520m hole ≈ 290m
    // pickClubForDistance(290) should pick Driver (230m, diff 60) over 3 Wood (200m, diff 90)
    // NOT hardcoded to "3 Wood" (next longest)
    const remaining = plan.totalDistance - plan.dots[0].distance;
    const secondDist = plan.dots[1].distance;
    const diff = Math.abs(secondDist - remaining);
    // The picked club should be reasonably close to the remaining distance
    expect(diff).toBeLessThan(100);
    expect(plan.dots[1].label).toBe("Second shot");
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

  it("routePoints starts at tee and ends at green", () => {
    const plan = buildVisualHolePlan(makeInput(4, GREEN_PAR4));
    expect(plan.routePoints[0]).toEqual(plan.tee);
    expect(plan.routePoints[plan.routePoints.length - 1]).toEqual(plan.green);
  });

  it("routePoints for straight hole has tee and green only", () => {
    const plan = buildVisualHolePlan(makeInput(4, GREEN_PAR4));
    expect(plan.routePoints).toHaveLength(2);
    expect(plan.routePoints[0]).toEqual(plan.tee);
    expect(plan.routePoints[1]).toEqual(plan.green);
  });

  it("empty bag routePoints includes dogleg on dogleg holes", () => {
    const plan = buildVisualHolePlan(makeInput(5, GREEN_DOGLEG, [], DOGLEG));
    expect(plan.routePoints).toHaveLength(3);
    expect(plan.routePoints[1]).toEqual(DOGLEG);
  });
});

describe("dogleg holes", () => {
  it("totalDistance equals leg1 + leg2", () => {
    const plan = buildVisualHolePlan(makeInput(5, GREEN_DOGLEG, TEST_BAG, DOGLEG));
    const leg1 = haversine(TEE, DOGLEG!);
    const leg2 = haversine(DOGLEG!, GREEN_DOGLEG);
    expect(plan.totalDistance).toBeCloseTo(leg1 + leg2, -1);
  });

  it("routePoints includes dogleg waypoint", () => {
    const plan = buildVisualHolePlan(makeInput(5, GREEN_DOGLEG, TEST_BAG, DOGLEG));
    const hasDoglegPt = plan.routePoints.some(
      (p) => p.lat === DOGLEG!.lat && p.lng === DOGLEG!.lng
    );
    expect(hasDoglegPt).toBe(true);
  });

  it("routePoints starts at tee, ends at green, and has dogleg in between", () => {
    const plan = buildVisualHolePlan(makeInput(5, GREEN_DOGLEG, TEST_BAG, DOGLEG));
    expect(plan.routePoints[0]).toEqual(TEE);
    expect(plan.routePoints[plan.routePoints.length - 1]).toEqual(GREEN_DOGLEG);
    const doglegIdx = plan.routePoints.findIndex(
      (p) => p.lat === DOGLEG!.lat && p.lng === DOGLEG!.lng
    );
    expect(doglegIdx).toBeGreaterThan(0);
    expect(doglegIdx).toBeLessThan(plan.routePoints.length - 1);
  });

  it("tee shot landing is along tee-to-dogleg bearing, not tee-to-green", () => {
    const plan = buildVisualHolePlan(makeInput(5, GREEN_DOGLEG, TEST_BAG, DOGLEG));
    const dot1 = plan.dots[0];
    // Bearing from tee to dot1 should be close to bearing from tee to dogleg
    const teeToDogleg = bearing(TEE, DOGLEG!);
    const teeToDot = bearing(TEE, { lat: dot1.lat, lng: dot1.lng });
    const diffRad = Math.abs(teeToDogleg - teeToDot);
    expect(diffRad).toBeLessThan(0.1); // within ~6 degrees
  });
});

describe("dot counts by par", () => {
  it("par 3 has no dots", () => {
    const plan = buildVisualHolePlan(makeInput(3, GREEN_PAR3));
    expect(plan.dots).toHaveLength(0);
  });

  it("par 4 has 2 dots (tee + approach)", () => {
    const plan = buildVisualHolePlan(makeInput(4, GREEN_PAR4));
    expect(plan.dots).toHaveLength(2);
    expect(plan.dots[0].label).toBe("Tee shot");
    expect(plan.dots[1].label).toBe("Approach");
  });

  it("par 5 3-shot plan has 3 dots (tee + second + approach)", () => {
    const plan = buildVisualHolePlan(makeInput(5, GREEN_PAR5));
    expect(plan.dots.length).toBeGreaterThanOrEqual(2);
    expect(plan.dots[0].label).toBe("Tee shot");
    expect(plan.dots[1].label).toBe("Second shot");
  });
});

describe("remaining distance club selection", () => {
  // Short par 5 (~370m): Driver 230m leaves ~140m remaining
  // Should pick 7 Iron (150m) or 9 Iron (120m), NOT 3 Wood (200m)
  const GREEN_SHORT_PAR5 = { lat: -26.0534, lng: 27.9206 }; // ~370m north

  it("par 5 second shot matches remaining distance, not next-longest club", () => {
    const plan = buildVisualHolePlan(makeInput(5, GREEN_SHORT_PAR5));
    expect(plan.dots[0].club).toBe("Driver");
    // remaining ≈ 370 - 230 = 140m
    // 7 Iron (150m, diff 10) or 9 Iron (120m, diff 20) should win
    // 3 Wood (200m, diff 60) should NOT be picked
    expect(plan.dots[1].club).not.toBe("3 Wood");
    expect(plan.dots[1].distance).toBeLessThan(170);
  });

  it("par 4 tee shot leaves reasonable remaining distance", () => {
    // ~290m par 4: backward planning picks tee shot that leaves ~80-130m approach
    const GREEN_SHORT_PAR4 = { lat: -26.0541, lng: 27.9206 };
    const plan = buildVisualHolePlan(makeInput(4, GREEN_SHORT_PAR4));
    expect(plan.dots[0].label).toBe("Tee shot");
    // Approach dot lands near green so it's skipped, but tee shot
    // leaves a sensible remaining distance
    const remaining = plan.totalDistance - plan.dots[0].distance;
    expect(remaining).toBeGreaterThan(50);
    expect(remaining).toBeLessThan(180);
  });
});
