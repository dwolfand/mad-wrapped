export interface MonthlyCount {
  month: string;
  count: number;
}

export interface LocationStats {
  name: string;
  count: number;
  percentage: number;
}

export interface ClassmateStats {
  firstName: string;
  lastName: string;
  sharedClasses: number;
}

export interface PeerStats {
  averageClassesPerMonth: number;
  averageEarlyBirdScore: number;
  averageLateBookings: number;
  averageCancellations: number;
  topClassmates: ClassmateStats[];
  percentiles: {
    totalClasses: number;
    earlyBirdScore: number;
    classesPerMonth: number;
    lateBookings: number;
    cancellations: number;
  };
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
  locationBreakdown: LocationStats[];
  peerComparison: PeerStats;
}
