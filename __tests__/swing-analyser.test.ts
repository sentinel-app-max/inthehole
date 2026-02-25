import { analyseSwings, getClubBreakdown } from "../lib/swing/analyser";
import type { SwingSession } from "../types";

const makeShot = (overrides: Partial<SwingSession> = {}): SwingSession => ({
  id: Math.random().toString(36).substring(2),
  userId: "test-user",
  date: "2026-02-25T10:00:00Z",
  club: "7i",
  targetDistance: 150,
  actualDistance: 145,
  shotShape: "straight",
  contactQuality: "pure",
  result: "good",
  createdAt: "2026-02-25T10:00:00Z",
  ...overrides,
});

const makeShots = (
  count: number,
  overrides: Partial<SwingSession> = {}
): SwingSession[] => Array.from({ length: count }, () => makeShot(overrides));

describe("analyseSwings", () => {
  it("empty array returns totalShots: 0", () => {
    const result = analyseSwings([]);
    expect(result.totalShots).toBe(0);
    expect(result.pureRate).toBe(0);
    expect(result.mostCommonMiss).toBe("Not enough data");
    expect(result.bestClub).toBe("Not enough data");
  });

  it("fewer than 5 shots returns partial analysis", () => {
    const shots = makeShots(3);
    const result = analyseSwings(shots);
    expect(result.totalShots).toBe(3);
    expect(result.pureRate).toBe(100);
    expect(result.mostCommonMiss).toBe("Not enough data");
    expect(result.mostCommonBadContact).toBe("Not enough data");
    expect(result.bestClub).toBe("Not enough data");
    expect(result.worstClub).toBe("Not enough data");
    expect(result.avgDistanceVariance).toBe(0);
  });

  it("calculates pure rate correctly", () => {
    const shots = [
      ...makeShots(3, { contactQuality: "pure" }),
      ...makeShots(7, { contactQuality: "thin" }),
    ];
    const result = analyseSwings(shots);
    expect(result.pureRate).toBe(30);
  });

  it("identifies most common miss correctly", () => {
    const shots = [
      ...makeShots(3, { shotShape: "slice" }),
      ...makeShots(2, { shotShape: "hook" }),
      ...makeShots(1, { shotShape: "fade" }),
      ...makeShots(2, { shotShape: "straight" }),
    ];
    const result = analyseSwings(shots);
    expect(result.mostCommonMiss).toBe("slice");
  });

  it("identifies most common bad contact correctly", () => {
    const shots = [
      ...makeShots(4, { contactQuality: "thin" }),
      ...makeShots(2, { contactQuality: "fat" }),
      ...makeShots(1, { contactQuality: "topped" }),
      ...makeShots(1, { contactQuality: "pure" }),
    ];
    const result = analyseSwings(shots);
    expect(result.mostCommonBadContact).toBe("thin");
  });

  it("best club has highest pure rate (min 3 shots)", () => {
    const shots = [
      // 7i: 3 pure out of 3 = 100%
      ...makeShots(3, { club: "7i", contactQuality: "pure" }),
      // PW: 1 pure out of 3 = 33%
      ...makeShots(1, { club: "PW", contactQuality: "pure" }),
      ...makeShots(2, { club: "PW", contactQuality: "thin" }),
    ];
    const result = analyseSwings(shots);
    expect(result.bestClub).toBe("7i");
  });

  it("worst club has lowest pure rate (min 3 shots)", () => {
    const shots = [
      ...makeShots(3, { club: "7i", contactQuality: "pure" }),
      ...makeShots(1, { club: "PW", contactQuality: "pure" }),
      ...makeShots(2, { club: "PW", contactQuality: "thin" }),
    ];
    const result = analyseSwings(shots);
    expect(result.worstClub).toBe("PW");
  });

  it("clubs with fewer than 3 shots do not qualify for best/worst", () => {
    const shots = [
      // 7i: 2 shots (doesn't qualify)
      ...makeShots(2, { club: "7i", contactQuality: "pure" }),
      // PW: 3 shots (qualifies)
      ...makeShots(3, { club: "PW", contactQuality: "pure" }),
    ];
    const result = analyseSwings(shots);
    expect(result.bestClub).toBe("PW");
    expect(result.worstClub).toBe("PW");
  });

  it("calculates avg distance variance correctly", () => {
    const shots = [
      makeShot({ targetDistance: 150, actualDistance: 145 }), // 5
      makeShot({ targetDistance: 150, actualDistance: 155 }), // 5
      makeShot({ targetDistance: 100, actualDistance: 100 }), // 0
      makeShot({ targetDistance: 100, actualDistance: 110 }), // 10
      makeShot({ targetDistance: 100, actualDistance: 90 }),  // 10
    ];
    // total variance = 30, avg = 6.0
    const result = analyseSwings(shots);
    expect(result.avgDistanceVariance).toBe(6);
  });

  it("all straight shots returns 'straight' as most common miss", () => {
    const shots = makeShots(6, { shotShape: "straight" });
    const result = analyseSwings(shots);
    expect(result.mostCommonMiss).toBe("straight");
  });

  it("all pure contact returns 'pure' as most common bad contact", () => {
    const shots = makeShots(6, { contactQuality: "pure" });
    const result = analyseSwings(shots);
    expect(result.mostCommonBadContact).toBe("pure");
  });
});

describe("getClubBreakdown", () => {
  it("returns correct count per club", () => {
    const shots = [
      ...makeShots(5, { club: "7i" }),
      ...makeShots(3, { club: "PW" }),
      ...makeShots(2, { club: "Driver" }),
    ];
    const breakdown = getClubBreakdown(shots);
    expect(breakdown).toHaveLength(3);

    const iron7 = breakdown.find((c) => c.club === "7i");
    const pw = breakdown.find((c) => c.club === "PW");
    const driver = breakdown.find((c) => c.club === "Driver");
    expect(iron7?.totalShots).toBe(5);
    expect(pw?.totalShots).toBe(3);
    expect(driver?.totalShots).toBe(2);
  });

  it("sorts by totalShots descending", () => {
    const shots = [
      ...makeShots(2, { club: "Driver" }),
      ...makeShots(5, { club: "7i" }),
      ...makeShots(3, { club: "PW" }),
    ];
    const breakdown = getClubBreakdown(shots);
    expect(breakdown[0].club).toBe("7i");
    expect(breakdown[1].club).toBe("PW");
    expect(breakdown[2].club).toBe("Driver");
  });

  it("calculates per-club pure rate and variance", () => {
    const shots = [
      makeShot({ club: "7i", contactQuality: "pure", targetDistance: 150, actualDistance: 150 }),
      makeShot({ club: "7i", contactQuality: "thin", targetDistance: 150, actualDistance: 140 }),
    ];
    const breakdown = getClubBreakdown(shots);
    const iron7 = breakdown.find((c) => c.club === "7i")!;
    expect(iron7.pureRate).toBe(50);
    expect(iron7.avgVariance).toBe(5);
  });

  it("identifies common miss per club", () => {
    const shots = [
      makeShot({ club: "Driver", shotShape: "slice" }),
      makeShot({ club: "Driver", shotShape: "slice" }),
      makeShot({ club: "Driver", shotShape: "hook" }),
    ];
    const breakdown = getClubBreakdown(shots);
    const driver = breakdown.find((c) => c.club === "Driver")!;
    expect(driver.commonMiss).toBe("slice");
  });
});
