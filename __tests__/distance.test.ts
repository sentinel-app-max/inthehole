import {
  haversineDistance,
  getWindEffect,
  adjustDistance,
  recommendClub,
  enrichBagWithSwingData,
} from "../lib/golf/distance";
import type { BagClub, SwingSession } from "../types";

// ── Haversine ───────────────────────────────────────────────────────

describe("haversineDistance", () => {
  it("returns 0 for the same point", () => {
    const p = { lat: -33.9, lng: 18.4 };
    expect(haversineDistance(p, p)).toBe(0);
  });

  it("calculates Cape Town to Joburg (~1260 km)", () => {
    const ct = { lat: -33.9249, lng: 18.4241 };
    const jnb = { lat: -26.2041, lng: 28.0473 };
    const d = haversineDistance(ct, jnb);
    expect(d).toBeGreaterThan(1_250_000);
    expect(d).toBeLessThan(1_280_000);
  });

  it("calculates a short golf distance (~150m)", () => {
    const tee = { lat: -33.9000, lng: 18.4000 };
    const green = { lat: -33.8987, lng: 18.4001 };
    const d = haversineDistance(tee, green);
    expect(d).toBeGreaterThan(140);
    expect(d).toBeLessThan(160);
  });
});

// ── Wind ────────────────────────────────────────────────────────────

describe("getWindEffect", () => {
  it("returns head for N", () => expect(getWindEffect("N")).toBe("head"));
  it("returns tail for S", () => expect(getWindEffect("S")).toBe("tail"));
  it("returns cross for E", () => expect(getWindEffect("E")).toBe("cross"));
  it("returns cross for NW", () => expect(getWindEffect("NW")).toBe("cross"));
});

describe("adjustDistance", () => {
  it("returns base when calm", () => {
    const r = adjustDistance(150, "calm", "N");
    expect(r.distance).toBe(150);
    expect(r.type).toBe("calm");
  });

  it("reduces 10% for moderate headwind", () => {
    const r = adjustDistance(150, "moderate", "N");
    expect(r.distance).toBe(135);
    expect(r.type).toBe("head");
  });

  it("increases 8% for moderate tailwind", () => {
    const r = adjustDistance(150, "moderate", "S");
    expect(r.distance).toBe(162);
    expect(r.type).toBe("tail");
  });

  it("returns base for crosswind", () => {
    const r = adjustDistance(150, "strong", "E");
    expect(r.distance).toBe(150);
    expect(r.type).toBe("cross");
  });
});

// ── Recommendation ──────────────────────────────────────────────────

describe("recommendClub", () => {
  const clubs: BagClub[] = [
    { name: "7i", distance: 150 },
    { name: "8i", distance: 140 },
    { name: "9i", distance: 125 },
  ];

  it("returns null for empty bag", () => {
    expect(recommendClub(150, [], "calm", "N")).toBeNull();
  });

  it("returns perfect match within 5m", () => {
    const r = recommendClub(148, clubs, "calm", "N");
    expect(r).not.toBeNull();
    expect(r!.primary.name).toBe("7i");
    expect(r!.between).toBe(false);
  });

  it("returns between-clubs recommendation", () => {
    const r = recommendClub(133, clubs, "calm", "N");
    expect(r).not.toBeNull();
    expect(r!.between).toBe(true);
  });
});

// ── Swing Enrichment ────────────────────────────────────────────────

describe("enrichBagWithSwingData", () => {
  const clubs: BagClub[] = [
    { name: "7i", distance: 150 },
    { name: "9i", distance: 125 },
  ];

  const makeSession = (club: string, actual: number): SwingSession => ({
    id: Math.random().toString(),
    userId: "u1",
    date: "2026-02-01",
    club,
    targetDistance: 150,
    actualDistance: actual,
    shotShape: "straight",
    contactQuality: "pure",
    result: "good",
    createdAt: "2026-02-01",
  });

  it("does not change distance with fewer than 5 shots", () => {
    const sessions = [makeSession("7i", 145), makeSession("7i", 148)];
    const result = enrichBagWithSwingData(clubs, sessions);
    expect(result[0].distance).toBe(150);
  });

  it("uses average actual distance with 5+ shots", () => {
    const sessions = [
      makeSession("7i", 145),
      makeSession("7i", 148),
      makeSession("7i", 150),
      makeSession("7i", 152),
      makeSession("7i", 155),
    ];
    const result = enrichBagWithSwingData(clubs, sessions);
    expect(result[0].distance).toBe(150);
    expect(result[1].distance).toBe(125); // 9i untouched
  });

  it("returns original clubs when no sessions", () => {
    const result = enrichBagWithSwingData(clubs, []);
    expect(result).toEqual(clubs);
  });
});
