import { useState, useEffect } from "react";
import App from "./App";
import CoachApp from "./CoachApp";
import CoachSearch from "./CoachSearch";
import Landing from "./Landing";

function Router() {
  // Use hash for routing (GitHub Pages compatible)
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    // Handle hash changes
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Parse hash-based routing
  const hashPath = currentHash.split("?")[0]; // Get path without query params

  // Simple routing based on hash
  if (hashPath === "#/coach" || hashPath === "#/coach/") {
    return <CoachApp />;
  }

  if (hashPath === "#/coach-search" || hashPath === "#/coach-search/") {
    return <CoachSearch />;
  }

  // The MAD Wrapped experience lives at #/wrapped. Existing direct links carry a
  // clientId query param (e.g. /?clientId=...&studioId=...) — keep those working.
  const hasClientId = new URLSearchParams(window.location.search).has(
    "clientId"
  );
  if (
    hashPath === "#/wrapped" ||
    hashPath === "#/wrapped/" ||
    hasClientId
  ) {
    return <App />;
  }

  // Public landing page (home page).
  return <Landing />;
}

export default Router;


