import { useEffect } from "react";
import "./Landing.css";

function Landing() {
  useEffect(() => {
    document.title = "MADabolic — The Official Member App";
  }, []);

  return (
    <div className="landing">
      <div className="landing-bg" aria-hidden="true" />
      <div className="landing-overlay" aria-hidden="true" />

      <main className="landing-content">
        <img
          src="/mad_logo.svg"
          alt="MADabolic"
          className="landing-logo"
        />

        <div className="landing-badge">The Official Member App</div>

        <h1 className="landing-headline">
          Your training, membership,
          <br />
          and studio — in one app.
        </h1>

        <p className="landing-subhead">
          Welcome to the home of the MADabolic app. Book classes, track your
          workouts and progress, manage your membership, and stay connected
          with your studio — all from your phone.
        </p>

        <div className="landing-actions">
          <a
            className="landing-btn landing-btn-primary"
            href="https://madabolic.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit MADabolic.com
          </a>
        </div>
      </main>

      <footer className="landing-footer">
        <nav className="landing-footer-links">
          <a href="#/wrapped">MAD Wrapped</a>
          <span className="landing-footer-sep">·</span>
          <a
            href="https://madabolic.com/privacy-policy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Privacy Policy
          </a>
          <span className="landing-footer-sep">·</span>
          <a
            href="https://madabolic.com/terms/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms of Service
          </a>
        </nav>
        <div className="landing-copyright">
          © {new Date().getFullYear()} MADabolic. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default Landing;
