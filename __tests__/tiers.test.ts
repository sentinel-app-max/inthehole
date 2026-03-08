import {
  getHandicapTier,
  getTierThresholds,
  isDriver,
  is3Wood,
  getApproachClubs,
  approachScore,
} from "../lib/strategy/tiers";
import type { BagClub } from "../types";

// ── Tier resolution ──────────────────────────────────────────────────

describe("getHandicapTier", () => {
  it("returns LOW for 0-10", () => {
    expect(getHandicapTier(0)).toBe("LOW");
    expect(getHandicapTier(5)).toBe("LOW");
    expect(getHandicapTier(10)).toBe("LOW");
  });

  it("returns MID for 11-20", () => {
    expect(getHandicapTier(11)).toBe("MID");
    expect(getHandicapTier(15)).toBe("MID");
    expect(getHandicapTier(18)).toBe("MID");
    expect(getHandicapTier(20)).toBe("MID");
  });

  it("returns HIGH for 21+", () => {
    expect(getHandicapTier(21)).toBe("HIGH");
    expect(getHandicapTier(30)).toBe("HIGH");
    expect(getHandicapTier(54)).toBe("HIGH");
  });
});

describe("getTierThresholds", () => {
  it("LOW tier has wider approach and go-for-it ranges", () => {
    const t = getTierThresholds(5);
    expect(t.tier).toBe("LOW");
    expect(t.maxApproachDist).toBe(200);
    expect(t.par5GoForItMax).toBe(500);
    expect(t.idealApproach).toBe(125);
    expect(t.idealApproachLow).toBe(100);
    expect(t.idealApproachHigh).toBe(150);
  });

  it("MID tier matches old 18-hcp constants", () => {
    const t = getTierThresholds(18);
    expect(t.tier).toBe("MID");
    expect(t.maxApproachDist).toBe(170);
    expect(t.par5GoForItMax).toBe(420);
    expect(t.idealApproach).toBe(105);
    expect(t.idealApproachLow).toBe(80);
    expect(t.idealApproachHigh).toBe(130);
  });

  it("HIGH tier has tighter approach and go-for-it ranges", () => {
    const t = getTierThresholds(25);
    expect(t.tier).toBe("HIGH");
    expect(t.maxApproachDist).toBe(150);
    expect(t.par5GoForItMax).toBe(380);
    expect(t.idealApproach).toBe(90);
    expect(t.idealApproachLow).toBe(70);
    expect(t.idealApproachHigh).toBe(110);
  });
});

// ── Shared helpers ───────────────────────────────────────────────────

describe("isDriver", () => {
  it("matches Driver (case-insensitive)", () => {
    expect(isDriver({ name: "Driver", distance: 230 })).toBe(true);
    expect(isDriver({ name: "driver", distance: 230 })).toBe(true);
    expect(isDriver({ name: "3 Wood", distance: 200 })).toBe(false);
  });
});

describe("is3Wood", () => {
  it("matches 3 Wood (case-insensitive)", () => {
    expect(is3Wood({ name: "3 Wood", distance: 200 })).toBe(true);
    expect(is3Wood({ name: "3 wood", distance: 200 })).toBe(true);
    expect(is3Wood({ name: "Driver", distance: 230 })).toBe(false);
  });
});

describe("getApproachClubs", () => {
  const clubs: BagClub[] = [
    { name: "Driver", distance: 230 },
    { name: "3 Wood", distance: 200 },
    { name: "5 Iron", distance: 170 },
    { name: "7 Iron", distance: 150 },
    { name: "PW", distance: 100 },
  ];

  it("excludes Driver and 3 Wood", () => {
    const result = getApproachClubs(clubs, 200);
    expect(result.find((c) => c.name === "Driver")).toBeUndefined();
    expect(result.find((c) => c.name === "3 Wood")).toBeUndefined();
  });

  it("filters by maxApproachDist", () => {
    const result = getApproachClubs(clubs, 150);
    expect(result).toHaveLength(2); // 7 Iron (150) + PW (100)
    expect(result.map((c) => c.name)).toEqual(
      expect.arrayContaining(["7 Iron", "PW"])
    );
  });

  it("wider threshold includes more clubs", () => {
    const narrow = getApproachClubs(clubs, 150);
    const wide = getApproachClubs(clubs, 200);
    expect(wide.length).toBeGreaterThan(narrow.length);
  });
});

describe("approachScore", () => {
  it("returns 0 at ideal centre within zone", () => {
    const t = getTierThresholds(18); // MID: ideal 105, zone 80-130
    expect(approachScore(105, t)).toBe(0);
  });

  it("adds penalty outside ideal zone", () => {
    const t = getTierThresholds(18);
    const inZone = approachScore(100, t); // 80-130 zone, diff 5
    const outZone = approachScore(50, t); // outside 80-130, diff 55 + 30 penalty
    expect(outZone).toBeGreaterThan(inZone + 20);
  });
});
