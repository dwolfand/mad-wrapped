import { useState, useEffect } from "react";
import { WorkoutStats } from "./types/stats";
import { STUDIOS, DUPONT_ID } from "./types/studios";
import SlideShow from "./components/SlideShow";
import IntroAnimation from "./components/IntroAnimation";
import { setUserProperties, trackView } from "./utils/analytics";
import "./App.css";

// API URL based on environment
const API_BASE_URL = import.meta.env.PROD
  ? "https://api.madwrapped.com" // Production URL
  : "http://localhost:8080/dev"; // Development URL

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
  const [email, setEmail] = useState("");
  const [showNotificationForm, setShowNotificationForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clientId, setClientId] = useState("");
  const [studioId, setStudioId] = useState(DUPONT_ID);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedStudio, setSelectedStudio] = useState(DUPONT_ID);
  const [otherStudio, setOtherStudio] = useState("");
  const [showOtherStudio, setShowOtherStudio] = useState(false);

  // Helper function to clean client ID
  const cleanClientId = (id: string) => {
    const decodedId = decodeURIComponent(id);
    return decodedId.replace(/[^0-9]/g, "");
  };

  // Helper function to clean studio ID
  const cleanStudioId = (id: string) => {
    const decodedId = decodeURIComponent(id);
    return decodedId.replace(/[^\w-]/g, "");
  };

  // Helper function to validate studio ID
  const validateStudioId = (id: string): string => {
    const cleanedId = cleanStudioId(id);
    return STUDIOS.some((studio) => studio.id === cleanedId)
      ? cleanedId
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
      setSuccessMessage(null);

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
      setUserProperties(cleanedId, validatedStudioId);
      trackView(cleanedId, validatedStudioId);

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

  const handleEmailLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      setShowNotificationForm(false);

      const response = await fetch(`${API_BASE_URL}/api/lookup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setShowNotificationForm(true);
          setError(
            "We don't have your stats quite yet. Would you like to be notified when they're ready?"
          );
        } else {
          setError(data.error || "Something went wrong. Please try again.");
        }
      } else {
        setSuccessMessage(
          data.message || "Check your email for a link to your year in review!"
        );
      }
    } catch (err) {
      setError("Failed to process your request. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !firstName || !lastName) return;

    const studio = showOtherStudio ? otherStudio : selectedStudio;
    if (!studio) return;

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/notify-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          studio,
          isCustomStudio: showOtherStudio,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to submit notification request.");
      } else {
        setSuccessMessage(data.message);
        setShowNotificationForm(false);
      }
    } catch (err) {
      setError(
        "Failed to submit notification request. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  const handleViewDavidsData = () => {
    fetchStats("100003434", DUPONT_ID);
  };

  const handleDirectAccess = (e: React.FormEvent) => {
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
        <img src="/mad_logo.svg" alt="MADabolic" className="madabolic-logo" />
        <div className="form-title">MAD Wrapped 2025</div>
        <div className="form-subtitle">
          Enter your email and we'll send you a direct link to your year in
          review.
        </div>
        {error && <div className="error">{error}</div>}
        {successMessage && <div className="success">{successMessage}</div>}

        {!showNotificationForm ? (
          <form onSubmit={handleEmailLookup} className="email-form">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="email-input"
              required
            />
            <button type="submit" className="submit-btn">
              Get My Wrapped
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleNotificationRequest}
            className="notification-form"
          >
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              className="name-input"
              required
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              className="name-input"
              required
            />
            <select
              value={showOtherStudio ? "other" : selectedStudio}
              onChange={(e) => {
                if (e.target.value === "other") {
                  setShowOtherStudio(true);
                } else {
                  setShowOtherStudio(false);
                  setSelectedStudio(e.target.value);
                }
              }}
              className="select"
              required
            >
              <option value="">Select your studio</option>
              {STUDIOS.map((studio) => (
                <option key={studio.id} value={studio.id}>
                  {studio.name}
                </option>
              ))}
              <option value="other">Other</option>
            </select>
            {showOtherStudio && (
              <input
                type="text"
                value={otherStudio}
                onChange={(e) => setOtherStudio(e.target.value)}
                placeholder="Enter your studio name"
                className="name-input"
                required
              />
            )}
            <button type="submit" className="submit-btn">
              Notify Me When Ready
            </button>
          </form>
        )}

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="advanced-toggle"
        >
          {showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}
        </button>

        {showAdvanced && (
          <>
            <form onSubmit={handleDirectAccess} className="client-id-form">
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
                className="select"
              >
                {STUDIOS.map((studio) => (
                  <option key={studio.id} value={studio.id}>
                    {studio.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="view-stats-btn">
                View Stats Directly
              </button>
            </form>
            <div className="divider">or</div>
            <button onClick={handleViewDavidsData} className="view-example-btn">
              See Example Year in Review
            </button>
          </>
        )}
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
        stats && <SlideShow stats={stats} studioId={studioId} />
      )}
    </div>
  );
}

export default App;
