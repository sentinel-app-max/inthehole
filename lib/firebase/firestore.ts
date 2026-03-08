import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type {
  Round,
  UserProfile,
  LeaderboardEntry,
  BagClub,
  SwingSession,
} from "@/types";

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

export async function saveMantra(uid: string, mantra: string): Promise<void> {
  try {
    await setDoc(doc(db, "users", uid), { mantra }, { merge: true });
  } catch (error) {
    console.error("saveMantra failed:", error);
    throw error;
  }
}

export async function getMantra(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return (snap.data() as UserProfile).mantra ?? null;
  } catch (error) {
    console.error("getMantra failed:", error);
    return null;
  }
}

export async function saveBag(uid: string, clubs: BagClub[]): Promise<void> {
  try {
    await setDoc(doc(db, "users", uid, "bag", "clubs"), { clubs });
  } catch (error) {
    console.error("saveBag failed:", error);
    throw error;
  }
}

export async function getBag(uid: string): Promise<BagClub[] | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid, "bag", "clubs"));
    return snap.exists() ? (snap.data().clubs as BagClub[]) : null;
  } catch (error) {
    console.error("getBag failed:", error);
    return null;
  }
}

export async function saveSwingSession(
  userId: string,
  session: SwingSession
): Promise<string> {
  try {
    const ref = doc(db, "users", userId, "swingSessions", session.id);
    await setDoc(ref, session);
    return session.id;
  } catch (error) {
    console.error("saveSwingSession failed:", error);
    throw error;
  }
}

export async function getSwingSessions(
  userId: string,
  maxResults?: number
): Promise<SwingSession[]> {
  try {
    const q = query(
      collection(db, "users", userId, "swingSessions"),
      orderBy("createdAt", "desc"),
      ...(maxResults ? [limit(maxResults)] : [])
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as SwingSession);
  } catch (error) {
    console.error("getSwingSessions failed:", error);
    return [];
  }
}

export async function deleteSwingSession(
  userId: string,
  sessionId: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, "users", userId, "swingSessions", sessionId));
  } catch (error) {
    console.error("deleteSwingSession failed:", error);
    throw error;
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
