import { useState, useEffect } from "react";
import { UserInfo } from "./types";
import { WorkoutStats } from "./types/stats";
import SlideShow from "./components/SlideShow";
import IntroAnimation from "./components/IntroAnimation";
import "./App.css";

function App() {
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to format the date
  const formatMemberSince = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  useEffect(() => {
    async function fetchStats() {
      try {
        // Get clientId from URL parameters
        const params = new URLSearchParams(window.location.search);
        const clientId = params.get("clientId");

        if (!clientId) {
          setError(
            "No client ID provided. Please use ?clientId=YOUR_ID in the URL."
          );
          setLoading(false);
          return;
        }

        const response = await fetch(
          `http://localhost:3001/api/stats/${clientId}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError("Stats not found for this client ID.");
          } else {
            setError("Failed to fetch stats. Please try again later.");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setStats(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching stats:", err);
        setError("Failed to fetch stats. Please try again later.");
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  if (loading) {
    return <div className="loading">Loading your year in review...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="app">
      {showIntro && stats ? (
        <IntroAnimation
          userInfo={{
            name: stats.firstName,
            memberSince: formatMemberSince(stats.firstSeen),
          }}
          onComplete={handleIntroComplete}
        />
      ) : (
        stats && <SlideShow stats={stats} />
      )}
    </div>
  );
}

export default App;
