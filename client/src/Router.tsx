import { useState, useEffect } from "react";
import App from "./App";
import CoachApp from "./CoachApp";
import CoachSearch from "./CoachSearch";

function Router() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    // Handle browser back/forward buttons
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Simple routing based on path
  if (currentPath === "/coach" || currentPath === "/coach/") {
    return <CoachApp />;
  }

  if (currentPath === "/coach-search" || currentPath === "/coach-search/") {
    return <CoachSearch />;
  }

  // Default to regular app
  return <App />;
}

export default Router;


