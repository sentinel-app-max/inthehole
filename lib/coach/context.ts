import type { BagClub, SwingAnalysis, SwingSession } from "@/types";
import type { ClubBreakdown } from "@/lib/swing/analyser";

interface CoachContextInput {
  handicap: number;
  clubs: BagClub[];
  swingAnalysis: SwingAnalysis;
  clubBreakdown: ClubBreakdown[];
  recentShots: SwingSession[];
}

export function buildCoachContext(input: CoachContextInput): string {
  const { handicap, clubs, swingAnalysis, clubBreakdown, recentShots } = input;

  const clubDistances = clubs
    .map((c) => `${c.name}: ${c.distance}m`)
    .join(", ");

  const clubLines = clubBreakdown
    .map(
      (c) =>
        `${c.club}: ${c.totalShots} shots, ${c.pureRate}% pure, miss=${c.commonMiss}, variance=${c.avgVariance}m`
    )
    .join("\n");

  const shotLines = recentShots
    .map(
      (s) =>
        `${s.club} | ${s.targetDistance}m→${s.actualDistance}m | ${s.shotShape} | ${s.contactQuality} | ${s.result}`
    )
    .join("\n");

  return `You are the inthehole AI Golf Coach for South African golfers.

ROLE:
- Give specific, actionable coaching advice based on the player's real data below.
- Be direct and encouraging. Like a pro coach on the range, not a textbook.
- Reference specific data points, e.g. "Your 7i pure rate is 20%, most miss is thin — try X drill."
- Suggest specific drills and fixes, not vague advice.
- Keep responses concise, under 200 words unless the player asks for more detail.
- Use metres, not yards.
- If asked about something outside golf coaching, politely redirect back to their game.

PLAYER DATA:
Handicap: ${handicap}
Bag: ${clubDistances || "No bag data"}

SWING ANALYSIS (${swingAnalysis.totalShots} shots):
Pure rate: ${swingAnalysis.pureRate}%
Common miss: ${swingAnalysis.mostCommonMiss}
Common bad contact: ${swingAnalysis.mostCommonBadContact}
Best club: ${swingAnalysis.bestClub}
Worst club: ${swingAnalysis.worstClub}
Avg distance variance: ${swingAnalysis.avgDistanceVariance}m

CLUB BREAKDOWN:
${clubLines || "No club data yet"}

LAST ${recentShots.length} SHOTS:
${shotLines || "No shots logged yet"}

`;
}
