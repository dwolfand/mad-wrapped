import { useState, useEffect } from "react";
import { CoachStats } from "./types/coachStats";
import CoachSlideShow from "./components/CoachSlideShow";
import IntroAnimation from "./components/IntroAnimation";
import { setUserProperties, trackView } from "./utils/analytics";
import "./App.css";

// API URL based on environment
const API_BASE_URL = import.meta.env.PROD
  ? "https://api.madwrapped.com" // Production URL
  : "http://localhost:8280/dev"; // Development URL

function CoachApp() {
  const [stats, setStats] = useState<CoachStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load coach stats from query parameters on mount
  useEffect(() => {
    // Get query params from hash URL
    const hash = window.location.hash;
    const queryString = hash.includes("?") ? hash.split("?")[1] : "";
    const params = new URLSearchParams(queryString);
    const firstName = params.get("firstName");
    const lastName = params.get("lastName");

    if (firstName && lastName) {
      fetchCoachStats(firstName, lastName);
    } else {
      // No query params, redirect to search page
      window.location.hash = "#/coach-search";
    }
  }, []);

  const fetchCoachStats = async (firstName: string, lastName: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE_URL}/api/coach-stats/${encodeURIComponent(
          firstName
        )}/${encodeURIComponent(lastName)}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError(
            "No stats found for this coach. They may not have coached any classes in 2025."
          );
        } else {
          setError("Failed to load coach stats. Please try again later.");
        }
        return;
      }

      const data: CoachStats = await response.json();
      setStats(data);
      setShowIntro(true);

      // Set analytics user properties
      setUserProperties(data.coachFullName, "coach");

      // Track page view
      trackView(data.coachFullName, "coach");
    } catch (err) {
      console.error("Error fetching coach stats:", err);
      setError("Failed to load coach stats. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  if (loading) {
    return <div className="loading">Loading coach wrapped...</div>;
  }

  if (error && !stats) {
    return (
      <div className="error-container">
        <div className="error-content">
          <h2>⚠️ Oops!</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // This component now expects query params, if none are provided
  // the useEffect will redirect to /coach-search
  if (!stats && !loading && !error) {
    return <div className="loading">Redirecting...</div>;
  }

  return (
    <div className="app">
      {showIntro && stats ? (
        <IntroAnimation
          userInfo={{
            name: `Coach ${stats.coachFirstName}`,
            memberSince: new Date(stats.firstClassDate).toLocaleDateString(
              "en-US",
              { month: "long", year: "numeric" }
            ),
          }}
          onComplete={handleIntroComplete}
        />
      ) : (
        stats && <CoachSlideShow stats={stats} />
      )}
    </div>
  );
}

export default CoachApp;
