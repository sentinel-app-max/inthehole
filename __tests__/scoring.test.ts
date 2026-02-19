import {
  courseHcp,
  hcpStrokesOnHole,
  stablefordPoints,
  scoreLabel,
  scoreClass,
  totalStableford,
  totalGross,
  toPar,
  netScore,
  rankPlayers,
} from "../lib/scoring/engine";
import type { Player, Course } from "../types";

const makeCourse = (pars: number[], sis: number[]): Course => ({
  id: "test",
  name: "Test Course",
  city: "Test",
  province: "Test",
  par: pars.reduce((a, b) => a + b, 0),
  rating: 72,
  slope: 113,
  holes: pars.map((par, i) => ({ hole: i + 1, par, si: sis[i] })),
  tees: [
    { colour: "blue", cr: 73.5, slope: 121 },
    { colour: "white", cr: 72, slope: 113 },
    { colour: "yellow", cr: 70.5, slope: 107 },
    { colour: "red", cr: 68.5, slope: 103 },
  ],
});

const par4x18 = makeCourse(
  Array(18).fill(4),
  Array.from({ length: 18 }, (_, i) => i + 1)
);

describe("courseHcp", () => {
  it("returns hi when slope=113 and cr=par", () => {
    expect(courseHcp(10, 113, 72, 72)).toBe(10);
    expect(courseHcp(20, 113, 72, 72)).toBe(20);
    expect(courseHcp(0, 113, 72, 72)).toBe(0);
    expect(courseHcp(36, 113, 72, 72)).toBe(36);
  });

  it("adjusts for slope and course rating", () => {
    // courseHcp(18, 137, 74.2, 72) = round((18*137/113) + 2.2) = round(24.02) = 24
    expect(courseHcp(18, 137, 74.2, 72)).toBe(24);
    // courseHcp(10, 140, 74.8, 72) = round((10*140/113) + 2.8) = round(15.19) = 15
    expect(courseHcp(10, 140, 74.8, 72)).toBe(15);
  });
});

describe("hcpStrokesOnHole", () => {
  it("handicap 0 gets no strokes on any hole", () => {
    for (let si = 1; si <= 18; si++) {
      expect(hcpStrokesOnHole(0, si)).toBe(0);
    }
  });

  it("handicap 18 gets 1 stroke on every hole", () => {
    for (let si = 1; si <= 18; si++) {
      expect(hcpStrokesOnHole(18, si)).toBe(1);
    }
  });

  it("handicap 36 gets 2 strokes on every hole", () => {
    for (let si = 1; si <= 18; si++) {
      expect(hcpStrokesOnHole(36, si)).toBe(2);
    }
  });

  it("handicap 20 gets 2 strokes on SI 1-2, 1 on SI 3-18", () => {
    expect(hcpStrokesOnHole(20, 1)).toBe(2);
    expect(hcpStrokesOnHole(20, 2)).toBe(2);
    for (let si = 3; si <= 18; si++) {
      expect(hcpStrokesOnHole(20, si)).toBe(1);
    }
  });
});

describe("stablefordPoints", () => {
  it("albatross (3 under net) = 5 pts", () => {
    expect(stablefordPoints(2, 5, 0)).toBe(5);
  });

  it("eagle (2 under net) = 4 pts", () => {
    expect(stablefordPoints(2, 4, 0)).toBe(4);
  });

  it("birdie (1 under net) = 3 pts", () => {
    expect(stablefordPoints(3, 4, 0)).toBe(3);
  });

  it("par (net par) = 2 pts", () => {
    expect(stablefordPoints(4, 4, 0)).toBe(2);
  });

  it("bogey (1 over net) = 1 pt", () => {
    expect(stablefordPoints(5, 4, 0)).toBe(1);
  });

  it("double bogey (2 over net) = 0 pts", () => {
    expect(stablefordPoints(6, 4, 0)).toBe(0);
  });

  it("applies hcp strokes correctly", () => {
    // gross 5 on par 4 with 1 hcp stroke = net 4 = par = 2 pts
    expect(stablefordPoints(5, 4, 1)).toBe(2);
  });

  it("returns null for score of 0", () => {
    expect(stablefordPoints(0, 4, 0)).toBeNull();
  });
});

describe("scoreLabel", () => {
  it("returns correct labels", () => {
    expect(scoreLabel(2, 5)).toBe("Albatross");
    expect(scoreLabel(2, 4)).toBe("Eagle");
    expect(scoreLabel(3, 4)).toBe("Birdie");
    expect(scoreLabel(4, 4)).toBe("Par");
    expect(scoreLabel(5, 4)).toBe("Bogey");
    expect(scoreLabel(6, 4)).toBe("Double");
    expect(scoreLabel(7, 4)).toBe("Triple");
    expect(scoreLabel(8, 4)).toBe("+4");
  });
});

describe("scoreClass", () => {
  it("returns correct CSS classes", () => {
    expect(scoreClass(2, 4)).toBe("score-eagle");
    expect(scoreClass(3, 4)).toBe("score-birdie");
    expect(scoreClass(4, 4)).toBe("score-par");
    expect(scoreClass(5, 4)).toBe("score-bogey");
    expect(scoreClass(6, 4)).toBe("score-double");
    expect(scoreClass(7, 4)).toBe("score-worse");
  });
});

describe("totalStableford", () => {
  it("calculates total stableford for a round", () => {
    const player: Player = {
      name: "Test",
      handicap: 0,
      tee: "white",
      scores: Array(18).fill(4), // all pars on par-4 course
    };
    expect(totalStableford(player, par4x18)).toBe(36); // 18 * 2
  });
});

describe("totalGross", () => {
  it("sums all scores", () => {
    const player: Player = { name: "Test", handicap: 0, tee: "white", scores: [4, 5, 3] };
    expect(totalGross(player)).toBe(12);
  });
});

describe("toPar", () => {
  it("returns difference from course par", () => {
    const player: Player = {
      name: "Test",
      handicap: 0,
      tee: "white",
      scores: Array(18).fill(5), // all bogeys
    };
    expect(toPar(player, par4x18)).toBe(18);
  });

  it("returns null for empty scores", () => {
    const player: Player = { name: "Test", handicap: 0, tee: "white", scores: [] };
    expect(toPar(player, par4x18)).toBeNull();
  });
});

describe("netScore", () => {
  it("subtracts hcp strokes from gross", () => {
    const player: Player = {
      name: "Test",
      handicap: 18,
      tee: "white",
      scores: Array(18).fill(5),
    };
    // gross 90, courseHcp(18, 113, 72, 72) = 18, so 18 holes get 1 stroke off
    expect(netScore(player, par4x18)).toBe(90 - 18);
  });
});

describe("rankPlayers", () => {
  const playerA: Player = {
    name: "A",
    handicap: 0,
    tee: "white",
    scores: Array(18).fill(4),
  };
  const playerB: Player = {
    name: "B",
    handicap: 0,
    tee: "white",
    scores: Array(18).fill(3),
  };

  it("ranks by stableford descending", () => {
    const ranked = rankPlayers([playerA, playerB], par4x18, "stableford");
    expect(ranked[0].name).toBe("B");
    expect(ranked[1].name).toBe("A");
  });

  it("ranks by net score ascending for strokeplay", () => {
    const ranked = rankPlayers([playerA, playerB], par4x18, "strokeplay");
    expect(ranked[0].name).toBe("B");
    expect(ranked[1].name).toBe("A");
  });
});
