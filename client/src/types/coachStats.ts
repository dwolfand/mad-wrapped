export interface CoachMonthlyCount {
  month: string;
  count: number;
  uniqueStudents: number;
}

export interface CoachStudentStats {
  firstName: string;
  lastName: string;
  totalClasses: number;
  firstClass: string;
  lastClass: string;
}

export interface CoachLocationStats {
  name: string;
  classCount: number;
  percentage: number;
}

export interface CoachTimeSlotStats {
  timeSlot: string;
  classCount: number;
  percentage: number;
}

export interface CoachStats {
  coachFirstName: string;
  coachLastName: string;
  coachFullName: string;
  firstClassDate: string;
  totalClasses: number;
  totalStudentVisits: number;
  uniqueStudents: number;
  locations: CoachLocationStats[];
  totalTeachingHours: number;
  busiestMonth: {
    month: string;
    classCount: number;
    uniqueStudents: number;
  };
  averageClassSize: number;
  topStudents: CoachStudentStats[];
  favoriteTimeSlot: CoachTimeSlotStats;
  allTimeSlots: CoachTimeSlotStats[];
  monthlyBreakdown: CoachMonthlyCount[];
  mostPopularDay: string;
  totalDurabilityClasses: number;
  totalAnaerobicClasses: number;
  totalMomentumClasses: number;
  totalDeloadClasses: number;
  studentRetentionRate: number;
  longestTeachingStreak: number;
  earlyMorningWarrior: boolean;
  lateNightHero: boolean;
  lastUpdated: string;
}

export interface CoachListItem {
  firstName: string;
  lastName: string;
  fullName: string;
  classCount: number;
}


