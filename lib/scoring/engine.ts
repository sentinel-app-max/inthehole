import type { Player, Course, ScoringType } from "@/types";

export function playingHcp(exactHcp: number): number {
  return Math.round(exactHcp * 0.95);
}

export function hcpStrokesOnHole(playingHcp: number, si: number): number {
  if (playingHcp <= 0) return 0;
  const full = Math.floor(playingHcp / 18);
  const remainder = playingHcp % 18;
  return full + (si <= remainder ? 1 : 0);
}

export function stablefordPoints(
  gross: number,
  par: number,
  hcpStrokes: number
): number | null {
  if (gross <= 0) return null;
  const net = gross - hcpStrokes;
  const diff = net - par;
  if (diff <= -3) return 5;
  if (diff === -2) return 4;
  if (diff === -1) return 3;
  if (diff === 0) return 2;
  if (diff === 1) return 1;
  return 0;
}

export function scoreLabel(gross: number, par: number): string {
  const diff = gross - par;
  if (diff <= -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double";
  if (diff === 3) return "Triple";
  return `+${diff}`;
}

export function scoreClass(gross: number, par: number): string {
  const diff = gross - par;
  if (diff <= -2) return "score-eagle";
  if (diff === -1) return "score-birdie";
  if (diff === 0) return "score-par";
  if (diff === 1) return "score-bogey";
  if (diff === 2) return "score-double";
  return "score-worse";
}

export function totalStableford(player: Player, course: Course): number {
  const phcp = playingHcp(player.handicap);
  return player.scores.reduce((total, gross, i) => {
    if (i >= course.holes.length) return total;
    const hole = course.holes[i];
    const strokes = hcpStrokesOnHole(phcp, hole.si);
    const pts = stablefordPoints(gross, hole.par, strokes);
    return total + (pts ?? 0);
  }, 0);
}

export function totalGross(player: Player): number {
  return player.scores.reduce((sum, s) => sum + s, 0);
}

export function toPar(player: Player, course: Course): number | null {
  if (player.scores.length === 0) return null;
  const coursePar = player.scores.reduce((sum, _, i) => {
    if (i >= course.holes.length) return sum;
    return sum + course.holes[i].par;
  }, 0);
  return totalGross(player) - coursePar;
}

export function netScore(player: Player, course: Course): number {
  const phcp = playingHcp(player.handicap);
  return player.scores.reduce((sum, gross, i) => {
    if (i >= course.holes.length) return sum;
    const strokes = hcpStrokesOnHole(phcp, course.holes[i].si);
    return sum + (gross - strokes);
  }, 0);
}

export function rankPlayers(
  players: Player[],
  course: Course,
  scoringType: ScoringType
): Player[] {
  return [...players].sort((a, b) => {
    if (scoringType === "stableford") {
      return totalStableford(b, course) - totalStableford(a, course);
    }
    return netScore(a, course) - netScore(b, course);
  });
}
