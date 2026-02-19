import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Round, UserProfile, LeaderboardEntry } from "@/types";

export async function saveRound(round: Round): Promise<string> {
  try {
    const ref = doc(collection(db, "rounds"), round.id);
    await setDoc(ref, round);
    return round.id;
  } catch (error) {
    console.error("saveRound failed:", error);
    throw error;
  }
}

export async function getRound(roundId: string): Promise<Round | null> {
  try {
    const snap = await getDoc(doc(db, "rounds", roundId));
    return snap.exists() ? (snap.data() as Round) : null;
  } catch (error) {
    console.error("getRound failed:", error);
    return null;
  }
}

export async function getUserRounds(userId: string): Promise<Round[]> {
  try {
    const q = query(
      collection(db, "rounds"),
      where("userId", "==", userId),
      orderBy("date", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Round);
  } catch (error) {
    console.error("getUserRounds failed:", error);
    return [];
  }
}

export async function saveUserProfile(
  uid: string,
  profile: UserProfile
): Promise<void> {
  try {
    await setDoc(doc(db, "users", uid), profile);
  } catch (error) {
    console.error("saveUserProfile failed:", error);
    throw error;
  }
}

export async function getUserProfile(
  uid: string
): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (error) {
    console.error("getUserProfile failed:", error);
    return null;
  }
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const q = query(
      collection(db, "leaderboard"),
      orderBy("bestPts", "desc"),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as LeaderboardEntry);
  } catch (error) {
    console.error("getLeaderboard failed:", error);
    return [];
  }
}
