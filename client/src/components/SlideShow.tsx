import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WorkoutStats } from "../types";
import "./SlideShow.css";

interface SlideShowProps {
  stats: WorkoutStats;
}

const SlideShow = ({ stats }: SlideShowProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: "total-classes",
      content: (
        <>
          <h2>Your MAD Year in Numbers</h2>
          <div className="stat-number">{stats.totalClasses}</div>
          <p>Total Classes Crushed</p>
        </>
      ),
    },
    {
      id: "favorite-coach",
      content: (
        <>
          <h2>Your Favorite Coach</h2>
          <div className="stat-text">{stats.topCoach}</div>
          <p>Thanks for the motivation!</p>
        </>
      ),
    },
    {
      id: "time-patterns",
      content: (
        <>
          <h2>Your Workout Schedule</h2>
          <div className="time-patterns">
            <div className="pattern-item">
              <span className="highlight">{stats.favoriteTimeOfDay}</span>
              <p>Favorite Time</p>
            </div>
            <div className="pattern-item">
              <span className="highlight">{stats.mostFrequentDay}</span>
              <p>Most Frequent Day</p>
            </div>
            <div className="pattern-item">
              <span className="highlight">{stats.earlyBirdScore}%</span>
              <p>Early Bird Score</p>
            </div>
          </div>
        </>
      ),
    },
    {
      id: "streak",
      content: (
        <>
          <h2>Consistency is Key!</h2>
          <div className="stat-number">{stats.longestStreak}</div>
          <p>Longest Streak of Classes</p>
        </>
      ),
    },
    {
      id: "monthly-progress",
      content: (
        <>
          <h2>Your Year at MAD</h2>
          <div className="monthly-chart">
            {stats.classesPerMonth.map((month, index) => (
              <div key={month.month} className="month-bar">
                <motion.div
                  className="bar"
                  initial={{ height: 0 }}
                  animate={{ height: `${(month.count / 20) * 100}%` }}
                  transition={{ delay: index * 0.1 }}
                />
                <span className="month-label">{month.month}</span>
                <span className="count-label">{month.count}</span>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      id: "booking-habits",
      content: (
        <>
          <h2>Booking Habits</h2>
          <div className="booking-stats">
            <div className="booking-item">
              <span className="stat-circle">{stats.totalLateBookings}</span>
              <p>Last-Minute Bookings</p>
            </div>
            <div className="booking-item">
              <span className="stat-circle">{stats.totalCancellations}</span>
              <p>Cancellations</p>
            </div>
          </div>
        </>
      ),
    },
  ];

  const handleClick = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  return (
    <div className="slideshow" onClick={handleClick}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          className="slide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
        >
          {slides[currentSlide].content}
        </motion.div>
      </AnimatePresence>
      <div className="progress-dots">
        {slides.map((_, index) => (
          <div
            key={index}
            className={`dot ${index === currentSlide ? "active" : ""}`}
          />
        ))}
      </div>
    </div>
  );
};

export default SlideShow;
