export interface UserInfo {
  name: string;
  memberSince: string | null;
  avatar?: string;
}

export interface WorkoutStats {
  totalClasses: number;
  topCoach: string;
  favoriteTimeOfDay: string;
  totalCancellations: number;
  mostFrequentDay: string;
  longestStreak: number;
  totalLateBookings: number;
  earlyBirdScore: number; // Percentage of early morning classes
  topThreeTimeSlots: string[];
  classesPerMonth: { month: string; count: number }[];
  favoriteLocation: {
    name: string;
    percentage: number;
  };
}

export interface AnimationState {
  currentSlide: number;
  isTransitioning: boolean;
  hasSeenIntro: boolean;
}
