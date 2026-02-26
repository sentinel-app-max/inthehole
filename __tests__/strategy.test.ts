import { buildStrategy, type StrategyInput } from "../lib/strategy/engine";
import type { Course, BagClub, SwingSession } from "../types";

const TEST_COURSE: Course = {
  id: "test",
  name: "Test GC",
  city: "Joburg",
  province: "Gauteng",
  par: 72,
  rating: 71,
  slope: 128,
  holes: [
    { hole: 1, par: 4, si: 7 },
    { hole: 2, par: 3, si: 15 },
    { hole: 3, par: 5, si: 1 },
    { hole: 4, par: 4, si: 9 },
    { hole: 5, par: 4, si: 3 },
    { hole: 6, par: 3, si: 17 },
    { hole: 7, par: 4, si: 5 },
    { hole: 8, par: 5, si: 11 },
    { hole: 9, par: 4, si: 13 },
    { hole: 10, par: 4, si: 8 },
    { hole: 11, par: 3, si: 16 },
    { hole: 12, par: 5, si: 2 },
    { hole: 13, par: 4, si: 10 },
    { hole: 14, par: 4, si: 4 },
    { hole: 15, par: 4, si: 6 },
    { hole: 16, par: 3, si: 18 },
    { hole: 17, par: 4, si: 12 },
    { hole: 18, par: 5, si: 14 },
  ],
  tees: [
    { colour: "blue", cr: 72.5, slope: 136 },
    { colour: "white", cr: 71, slope: 128 },
    { colour: "yellow", cr: 69.5, slope: 122 },
    { colour: "red", cr: 67.5, slope: 118 },
  ],
};

const TEST_BAG: BagClub[] = [
  { name: "Driver", distance: 230 },
  { name: "3 Wood", distance: 200 },
  { name: "5 Hybrid", distance: 175 },
  { name: "6i", distance: 160 },
  { name: "7i", distance: 150 },
  { name: "8i", distance: 140 },
  { name: "9i", distance: 125 },
  { name: "PW", distance: 110 },
  { name: "52°", distance: 90 },
  { name: "56°", distance: 75 },
  { name: "60°", distance: 60 },
];

function makeInput(overrides?: Partial<StrategyInput>): StrategyInput {
  return {
    course: TEST_COURSE,
    tee: "white",
    handicap: 18,
    clubs: TEST_BAG,
    sessions: [],
    windDir: "N",
    windStr: "calm",
    ...overrides,
  };
}

function makeSession(club: string, shape: string): SwingSession {
  return {
    id: Math.random().toString(),
    userId: "u1",
    date: "2026-02-01",
    club,
    targetDistance: 150,
    actualDistance: 145,
    shotShape: shape as SwingSession["shotShape"],
    contactQuality: "pure",
    result: "good",
    createdAt: "2026-02-01",
  };
}

// ── Basic Output ─────────────────────────────────────────────────────

describe("buildStrategy", () => {
  it("returns 18 hole strategies", () => {
    const result = buildStrategy(makeInput());
    expect(result.holes).toHaveLength(18);
    expect(result.courseName).toBe("Test GC");
    expect(result.tee).toBe("white");
  });

  it("calculates course handicap", () => {
    const result = buildStrategy(makeInput({ handicap: 18 }));
    // courseHcp = round((18 * 128 / 113) + (71 - 72)) = round(20.37 - 1) = round(19.37) = 19
    expect(result.courseHcp).toBe(19);
  });

  // ── Par 3 ──────────────────────────────────────────────────────────

  it("returns 1 shot for par 3", () => {
    const result = buildStrategy(makeInput());
    const par3 = result.holes.find((h) => h.par === 3)!;
    expect(par3.shots).toHaveLength(1);
    expect(par3.shots[0].label).toBe("Tee shot");
  });

  it("picks closest club for par 3 (~155m)", () => {
    const result = buildStrategy(makeInput());
    const par3 = result.holes.find((h) => h.par === 3)!;
    // 155m target — closest clubs: 6i (160m) or 7i (150m)
    expect(["6i", "7i"]).toContain(par3.shots[0].club);
  });

  // ── Par 4 ──────────────────────────────────────────────────────────

  it("returns 2 shots for par 4 (tee + approach)", () => {
    const result = buildStrategy(makeInput());
    const par4 = result.holes.find((h) => h.par === 4)!;
    expect(par4.shots).toHaveLength(2);
    expect(par4.shots[0].label).toBe("Tee shot");
    expect(par4.shots[1].label).toBe("Approach");
  });

  it("uses driver for par 4 tee shot", () => {
    const result = buildStrategy(makeInput());
    const par4 = result.holes.find((h) => h.par === 4)!;
    expect(par4.shots[0].club).toBe("Driver");
  });

  // ── Par 5 ──────────────────────────────────────────────────────────

  it("returns 3 shots for par 5 (tee + second + approach)", () => {
    const result = buildStrategy(makeInput());
    const par5 = result.holes.find((h) => h.par === 5)!;
    expect(par5.shots).toHaveLength(3);
    expect(par5.shots[0].label).toBe("Tee shot");
    expect(par5.shots[1].label).toBe("Second shot");
    expect(par5.shots[2].label).toBe("Approach");
  });

  it("uses driver + second longest for par 5", () => {
    const result = buildStrategy(makeInput());
    const par5 = result.holes.find((h) => h.par === 5)!;
    expect(par5.shots[0].club).toBe("Driver");
    expect(par5.shots[1].club).toBe("3 Wood");
  });

  it("flags goForIt when par 5 reachable in 2", () => {
    // Driver 230 + 3 Wood 200 = 430 < 480, so NOT reachable
    const result = buildStrategy(makeInput());
    const par5 = result.holes.find((h) => h.par === 5)!;
    expect(par5.goForIt).toBe(false);

    // Big hitter: Driver 280 + 3 Wood 240 = 520 >= 480
    const bigBag: BagClub[] = [
      { name: "Driver", distance: 280 },
      { name: "3 Wood", distance: 240 },
      { name: "7i", distance: 150 },
    ];
    const big = buildStrategy(makeInput({ clubs: bigBag }));
    const bigPar5 = big.holes.find((h) => h.par === 5)!;
    expect(bigPar5.goForIt).toBe(true);
  });

  // ── Stroke Allocation ──────────────────────────────────────────────

  it("allocates strokes from handicap", () => {
    const result = buildStrategy(makeInput({ handicap: 18 }));
    // courseHcp = 19, so 19 holes get strokes
    // SI 1 through 18 all get 1 stroke (full = floor(19/18)=1, remainder=1)
    // SI 1 gets full(1) + (1<=1?1:0) = 2 strokes
    // SI 2-18 get full(1) + (si<=1?1:0) = 1 stroke
    const hole1SI7 = result.holes[0]; // SI 7
    expect(hole1SI7.strokes).toBe(1);
    expect(hole1SI7.targetScore).toBe(hole1SI7.par + 1);

    const hole3SI1 = result.holes[2]; // SI 1
    expect(hole3SI1.strokes).toBe(2);
  });

  // ── Notes ──────────────────────────────────────────────────────────

  it("adds hardest-hole note for low SI", () => {
    const result = buildStrategy(makeInput());
    const si1 = result.holes.find((h) => h.si === 1)!;
    expect(si1.notes).toContain("One of the hardest holes");
  });

  it("adds birdie-chance note for high SI", () => {
    const result = buildStrategy(makeInput());
    const si18 = result.holes.find((h) => h.si === 18)!;
    expect(si18.notes).toContain("Good birdie chance");
  });

  // ── Empty Bag ──────────────────────────────────────────────────────

  it("returns empty shots for empty bag", () => {
    const result = buildStrategy(makeInput({ clubs: [] }));
    expect(result.holes[0].shots).toHaveLength(0);
    expect(result.holes).toHaveLength(18);
  });

  // ── Wind ───────────────────────────────────────────────────────────

  it("wind adjustment affects club distances", () => {
    const calm = buildStrategy(makeInput({ windStr: "calm" }));
    const head = buildStrategy(makeInput({ windStr: "strong", windDir: "N" }));

    const calmPar3 = calm.holes.find((h) => h.par === 3)!;
    const headPar3 = head.holes.find((h) => h.par === 3)!;

    // With headwind, driver distance is reduced, so approach club might differ
    // At minimum, distances should differ for par 4 tee shots
    const calmPar4 = calm.holes.find((h) => h.par === 4)!;
    const headPar4 = head.holes.find((h) => h.par === 4)!;

    expect(headPar4.shots[0].distance).toBeLessThan(calmPar4.shots[0].distance);
  });

  // ── Miss Warnings ─────────────────────────────────────────────────

  it("populates miss warning from swing data", () => {
    const sessions = [
      makeSession("Driver", "slice"),
      makeSession("Driver", "slice"),
      makeSession("Driver", "slice"),
      makeSession("Driver", "fade"),
    ];
    const result = buildStrategy(makeInput({ sessions }));
    const par4 = result.holes.find((h) => h.par === 4)!;
    expect(par4.shots[0].missWarning).toBe("tends to slice");
  });

  it("no miss warning when shots are straight", () => {
    const sessions = [
      makeSession("Driver", "straight"),
      makeSession("Driver", "straight"),
      makeSession("Driver", "straight"),
    ];
    const result = buildStrategy(makeInput({ sessions }));
    const par4 = result.holes.find((h) => h.par === 4)!;
    expect(par4.shots[0].missWarning).toBeNull();
  });
});
