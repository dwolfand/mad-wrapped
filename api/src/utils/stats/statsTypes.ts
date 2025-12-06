// Shared types and constants for stats computation

// Year filter constants - use date ranges for index efficiency
export const STATS_YEAR = 2025;
export const YEAR_START = `${STATS_YEAR}-01-01`;
export const YEAR_END = `${STATS_YEAR}-12-31`;

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Generic query result type for pg
export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number | null;
}

// Result types
export interface ClientStatsResult {
  firstName: string;
  lastName: string;
  email: string;
  firstSeen: string;
  totalClasses: number;
  allTimeClasses: number;
  classesByYear: Array<{ year: number; count: number }>;
  totalCancellations: number;
  totalLateBookings: number;
  topCoach: string;
  favoriteTimeOfDay: string;
  topThreeTimeSlots: string[];
  mostFrequentDay: string;
  longestStreak: number;
  earlyBirdScore: number;
  classesPerMonth: Array<{ month: string; count: string }>;
  favoriteLocation: { name: string; percentage: number };
  locationBreakdown: Array<{ name: string; count: number; percentage: number }>;
  perfectMadWeeks: number;
  durabilityClasses: number;
  anaerobicClasses: number;
  momentumClasses: number;
  deloadClasses: number;
}

export interface PeerStatsResult {
  averageClassesPerMonth: number;
  averageEarlyBirdScore: number;
  averageLateBookings: number;
  averageCancellations: number;
  topClassmates: Array<{
    firstName: string;
    lastName: string;
    sharedClasses: number;
  }>;
  percentiles: {
    totalClasses: number;
    earlyBirdScore: number;
    classesPerMonth: number;
    lateBookings: number;
    cancellations: number;
    perfectWeeks: number;
  };
}

export interface GlobalStatsResult {
  totalMembers: number;
  totalClasses: number;
  averageClassesPerMember: number;
  mostPopularTimeSlot: string;
  mostPopularDay: string;
  mostPopularCoach: string;
  averageEarlyBirdScore: number;
}

export interface StatsResult {
  clientId: string;
  studioId: string;
  firstName: string;
  lastName: string;
  email: string;
  firstSeen: string;
  lastUpdated: string;
  totalClasses: number;
  allTimeClasses: number;
  classesByYear: Array<{ year: number; count: number }>;
  totalCancellations: number;
  totalLateBookings: number;
  topCoach: string;
  favoriteTimeOfDay: string;
  topThreeTimeSlots: string[];
  mostFrequentDay: string;
  longestStreak: number;
  earlyBirdScore: number;
  classesPerMonth: Array<{ month: string; count: string }>;
  favoriteLocation: { name: string; percentage: number };
  locationBreakdown: Array<{ name: string; count: number; percentage: number }>;
  perfectMadWeeks: number;
  durabilityClasses: number;
  anaerobicClasses: number;
  momentumClasses: number;
  deloadClasses: number;
  peerComparison: PeerStatsResult;
  globalStats: GlobalStatsResult;
}

// Helper to parse name from "LAST, FIRST" format
export function parseName(name: string): { firstName: string; lastName: string } {
  let firstName = "";
  let lastName = "";
  
  if (name.includes(",")) {
    const [lastPart, firstPart] = name.split(",").map((s) => s.trim());
    firstName = firstPart.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    lastName = lastPart.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  } else {
    const parts = name.split(" ");
    firstName = parts[0]?.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || "";
    lastName = parts.slice(1).join(" ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || "";
  }
  
  return { firstName, lastName };
}

