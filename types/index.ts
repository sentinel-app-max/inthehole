export interface Hole {
  hole: number;
  par: number;
  si: number;
}

export interface Course {
  id: string;
  name: string;
  city: string;
  province: string;
  par: number;
  rating: number;
  slope: number;
  holes: Hole[];
}

export interface Player {
  name: string;
  handicap: number;
  scores: number[];
}

export interface PlayerResult {
  name: string;
  handicap: number;
  stableford: number;
  gross: number;
  net: number;
  toPar: number;
  front9: number;
  back9: number;
  scores: number[];
}

export type ScoringType = "stableford" | "strokeplay";

export interface Round {
  id: string;
  userId: string;
  date: string;
  course: Course;
  players: Player[];
  playerResults: PlayerResult[];
  scoringType: ScoringType;
  holes: 9 | 18;
  complete: boolean;
  sharedAt?: string;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL?: string;
  rounds: number;
  totalPts: number;
  bestPts: number;
  bestNet: number;
  handicap: number;
  updatedAt: string;
}

export interface UserProfile {
  displayName: string;
  email: string;
  handicap: number;
  homeClub?: string;
  createdAt: string;
}
