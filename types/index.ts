export interface Hole {
  hole: number;
  par: number;
  si: number;
}

export type TeeColour = "blue" | "white" | "yellow" | "red";

export interface TeeDatum {
  colour: TeeColour;
  cr: number;
  slope: number;
}

export interface Course {
  id: string;
  name: string;
  city: string;
  province: string;
  par: number;
  rating: number;
  slope: number;
  lat: number;
  lng: number;
  holes: Hole[];
  tees: TeeDatum[];
}

export interface Player {
  name: string;
  handicap: number;
  tee: TeeColour;
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

export interface BagClub {
  name: string;
  distance: number;
}

export type WindDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type WindStrength = "calm" | "light" | "moderate" | "strong";

export type ShotShape =
  | "straight"
  | "fade"
  | "draw"
  | "slice"
  | "hook"
  | "push"
  | "pull";

export type ContactQuality =
  | "thin"
  | "fat"
  | "topped"
  | "pure"
  | "toe"
  | "heel";

export type ShotResult = "good" | "ok" | "miss";

export interface SwingSession {
  id: string;
  userId: string;
  date: string;
  club: string;
  targetDistance: number;
  actualDistance: number;
  shotShape: ShotShape;
  contactQuality: ContactQuality;
  result: ShotResult;
  notes?: string;
  createdAt: string;
}

export interface SwingAnalysis {
  totalShots: number;
  pureRate: number;
  mostCommonMiss: string;
  mostCommonBadContact: string;
  bestClub: string;
  worstClub: string;
  avgDistanceVariance: number;
}
