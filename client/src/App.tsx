import { useState, useEffect } from "react";
import { WorkoutStats } from "./types/stats";
import { STUDIOS, DUPONT_ID } from "./types/studios";
import SlideShow from "./components/SlideShow";
import IntroAnimation from "./components/IntroAnimation";
import { setUserProperties, trackView } from "./utils/analytics";
import "./App.css";

// API URL based on environment
const API_BASE_URL = import.meta.env.PROD
  ? "https://api-broken-bird-1053.fly.dev" // Production URL
  : "http://localhost:3005"; // Development URL

// Helper function to format the date
const formatMemberSince = (dateStr: string | null) => {
  if (!dateStr) {
    return null;
  }
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

function App() {
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [studioId, setStudioId] = useState(DUPONT_ID);

  // Helper function to clean client ID
  const cleanClientId = (id: string) => {
    const decodedId = decodeURIComponent(id);
    const cleanedId = decodedId.replace(/[^0-9]/g, "");
    return cleanedId;
  };

  // Helper function to validate studio ID
  const validateStudioId = (id: string): string => {
    const decodedId = decodeURIComponent(id);
    return STUDIOS.some((studio) => studio.id === decodedId)
      ? decodedId
      : DUPONT_ID;
  };

  // Load initial values from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlClientId = params.get("clientId");
    const urlStudioId = params.get("studioId");

    if (urlClientId) {
      setClientId(urlClientId);
      const validatedStudioId = validateStudioId(urlStudioId || DUPONT_ID);
      setStudioId(validatedStudioId);
      fetchStats(urlClientId, validatedStudioId);
    }
  }, []);

  const fetchStats = async (id: string, studio: string) => {
    try {
      setLoading(true);
      setError(null);

      const cleanedId = cleanClientId(id);
      const validatedStudioId = validateStudioId(studio);
      const response = await fetch(
        `${API_BASE_URL}/api/stats/${cleanedId}/${validatedStudioId}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError("Stats not found for this client ID and studio.");
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

      // Set analytics user properties and track view
      setUserProperties(cleanedId);
      trackView(cleanedId);

      // Update URL without refreshing the page
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("clientId", cleanedId);
      newUrl.searchParams.set("studioId", validatedStudioId);
      window.history.pushState({}, "", newUrl);
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError("Failed to fetch stats. Please try again later.");
      setLoading(false);
    }
  };

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  const handleViewDavidsData = () => {
    fetchStats("100003434", DUPONT_ID);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clientId) {
      fetchStats(clientId, studioId);
    }
  };

  if (loading) {
    return <div className="loading">Loading your year in review...</div>;
  }

  if (error || !stats) {
    return (
      <div className="error-container">
        <div className="form-title">
          Enter your client ID below or check out an example!
        </div>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit} className="client-id-form">
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Enter your client ID"
            className="client-id-input"
          />
          <select
            value={studioId}
            onChange={(e) => setStudioId(e.target.value)}
          >
            {STUDIOS.map((studio) => (
              <option key={studio.id} value={studio.id}>
                {studio.name}
              </option>
            ))}
          </select>
          <button type="submit" className="view-example-btn">
            View My Stats
          </button>
        </form>
        <div className="divider">or</div>
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
            memberSince: formatMemberSince(stats.firstSeen || null),
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
