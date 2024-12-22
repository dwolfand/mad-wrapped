import { useState, useEffect } from "react";
import { WorkoutStats } from "./types/stats";
import SlideShow from "./components/SlideShow";
import IntroAnimation from "./components/IntroAnimation";
import "./App.css";

// API URL based on environment
const API_BASE_URL = import.meta.env.PROD
  ? "https://api-broken-bird-1053.fly.dev" // Production URL
  : "http://localhost:8080"; // Development URL

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

  const fetchStats = async (clientId: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/stats/${clientId}`);

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
      setShowIntro(true);
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError("Failed to fetch stats. Please try again later.");
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get clientId from URL parameters
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get("clientId");

    if (!clientId) {
      setError("No client ID provided. Click below to see an example!");
      setLoading(false);
      return;
    }

    fetchStats(clientId);
  }, []);

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  const handleViewDavidsData = () => {
    // Update URL without refreshing the page
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("clientId", "100003434");
    window.history.pushState({}, "", newUrl);

    fetchStats("100003434");
  };

  if (loading) {
    return <div className="loading">Loading your year in review...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error">{error}</div>
        <button onClick={handleViewDavidsData} className="view-example-btn">
          See David's Year in Review
        </button>
      </div>
    );
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
