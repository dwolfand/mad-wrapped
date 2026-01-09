import { useState, useEffect } from "react";
import { CoachListItem } from "./types/coachStats";
import "./App.css";

// API URL based on environment
const API_BASE_URL = import.meta.env.PROD
  ? "https://api.madwrapped.com" // Production URL
  : "http://localhost:8280/dev"; // Development URL

function CoachSearch() {
  const [coaches, setCoaches] = useState<CoachListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCoachList, setShowCoachList] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load coaches list on mount
  useEffect(() => {
    fetchCoachesList();
  }, []);

  const fetchCoachesList = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/coaches`);
      if (!response.ok) {
        throw new Error("Failed to fetch coaches list");
      }
      const data = await response.json();
      setCoaches(data.coaches || []);
    } catch (err) {
      console.error("Error fetching coaches:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCoachSelect = (coach: CoachListItem) => {
    // Navigate to coach wrapped with query params (hash-based routing)
    window.location.hash = `#/coach?firstName=${encodeURIComponent(
      coach.firstName
    )}&lastName=${encodeURIComponent(coach.lastName)}`;
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setShowCoachList(query.length > 0);
  };

  const filteredCoaches = coaches.filter((coach) =>
    coach.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="loading">Loading coaches...</div>;
  }

  return (
    <div className="app">
      <div className="welcome-container">
        <img src="/mad_logo.svg" alt="MAD Logo" className="welcome-logo" />
        <h1 className="welcome-title">Coach Wrapped 2025</h1>
        <p className="welcome-subtitle">
          See your impact as a MADabolic coach
        </p>

        <div className="form-container">
          <button
            onClick={() => (window.location.hash = "")}
            className="student-link-btn"
          >
            ← Back to Student Wrapped
          </button>

          <div className="search-container">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search for a coach..."
              className="coach-search-input"
              onFocus={() => setShowCoachList(true)}
            />
            {showCoachList && filteredCoaches.length > 0 && (
              <div className="coach-dropdown">
                {filteredCoaches.slice(0, 10).map((coach, index) => (
                  <div
                    key={index}
                    className="coach-dropdown-item"
                    onClick={() => handleCoachSelect(coach)}
                  >
                    <div className="coach-dropdown-info">
                      <span className="coach-dropdown-name">
                        {coach.fullName}
                      </span>
                      <span className="coach-dropdown-count">
                        {coach.classCount} classes in 2025
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {searchQuery.length > 0 && filteredCoaches.length === 0 && (
            <p className="no-results">
              No coaches found matching "{searchQuery}"
            </p>
          )}

          <div className="info-text">
            <p>
              👋 Coaches: Search for your name above to see your 2025 wrapped!
            </p>
          </div>

          <div className="divider">Popular Coaches</div>

          <div className="popular-coaches">
            {coaches.slice(0, 6).map((coach, index) => (
              <button
                key={index}
                onClick={() => handleCoachSelect(coach)}
                className="popular-coach-btn"
              >
                {coach.fullName}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoachSearch;
