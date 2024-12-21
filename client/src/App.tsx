import { useState, useEffect } from "react";
import { WorkoutStats, UserInfo } from "./types";
import SlideShow from "./components/SlideShow";
import IntroAnimation from "./components/IntroAnimation";
import "./App.css";

function App() {
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [userInfo] = useState<UserInfo>({
    name: "David",
    memberSince: "January 2023",
  });

  useEffect(() => {
    // TODO: Replace with actual MindBody API call
    const mockStats: WorkoutStats = {
      totalClasses: 156,
      topCoach: "Coach Alex",
      favoriteTimeOfDay: "6:00 AM",
      totalCancellations: 5,
      mostFrequentDay: "Monday",
      longestStreak: 14,
      totalLateBookings: 8,
      earlyBirdScore: 75, // 75% of classes were early morning
      topThreeTimeSlots: ["6:00 AM", "5:30 PM", "7:00 AM"],
      classesPerMonth: [
        { month: "Jan", count: 15 },
        { month: "Feb", count: 12 },
        { month: "Mar", count: 14 },
        { month: "Apr", count: 13 },
        { month: "May", count: 12 },
        { month: "Jun", count: 15 },
        { month: "Jul", count: 11 },
        { month: "Aug", count: 13 },
        { month: "Sep", count: 14 },
        { month: "Oct", count: 12 },
        { month: "Nov", count: 13 },
        { month: "Dec", count: 12 },
      ],
    };

    setTimeout(() => {
      setStats(mockStats);
      setLoading(false);
    }, 1500);
  }, []);

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  if (loading) {
    return <div className="loading">Loading your year in review...</div>;
  }

  return (
    <div className="app">
      {showIntro && stats ? (
        <IntroAnimation userInfo={userInfo} onComplete={handleIntroComplete} />
      ) : (
        stats && <SlideShow stats={stats} />
      )}
    </div>
  );
}

export default App;
