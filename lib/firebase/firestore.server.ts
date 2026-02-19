import { adminDb } from "@/lib/firebase/admin";
import type { LeaderboardEntry, PlayerResult } from "@/types";

export async function updateLeaderboardEntry(
  result: PlayerResult,
  uid: string
): Promise<void> {
  try {
    const ref = adminDb.collection("leaderboard").doc(uid);
    const snap = await ref.get();
    const existing = snap.data() as LeaderboardEntry | undefined;

    const entry: LeaderboardEntry = {
      uid,
      displayName: result.name,
      rounds: (existing?.rounds ?? 0) + 1,
      totalPts: (existing?.totalPts ?? 0) + result.stableford,
      bestPts: Math.max(existing?.bestPts ?? 0, result.stableford),
      bestNet: existing
        ? Math.min(existing.bestNet, result.net)
        : result.net,
      handicap: result.handicap,
      updatedAt: new Date().toISOString(),
    };

    await ref.set(entry);
  } catch (error) {
    console.error("updateLeaderboardEntry failed:", error);
    throw error;
  }
}
