export interface MonthlyCount {
  month: string;
  count: number;
}

export interface LocationStats {
  name: string;
  percentage: number;
}

export interface WorkoutStats {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  firstSeen: string;
  lastUpdated: string;
  totalClasses: number;
  topCoach: string;
  favoriteTimeOfDay: string;
  totalCancellations: number;
  mostFrequentDay: string;
  longestStreak: number;
  totalLateBookings: number;
  earlyBirdScore: number;
  topThreeTimeSlots: string[];
  classesPerMonth: MonthlyCount[];
  favoriteLocation: LocationStats;
}
