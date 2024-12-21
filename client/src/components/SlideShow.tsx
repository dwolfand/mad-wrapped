import { useState, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { WorkoutStats } from "../types";
import "./SlideShow.css";

interface SlideShowProps {
  stats: WorkoutStats;
}

const SlideShow = ({ stats }: SlideShowProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const paginate = (direction: number) => {
    setCurrentSlide((prev) => {
      const nextSlide = prev + direction;
      if (nextSlide < 0) return slides.length - 1;
      if (nextSlide >= slides.length) return 0;
      return nextSlide;
    });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      paginate(-1);
    } else if (event.key === "ArrowRight") {
      paginate(1);
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDragEnd = (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const swipe = swipePower(info.offset.x, info.velocity.x);
    if (swipe < -swipeConfidenceThreshold) {
      paginate(1);
    } else if (swipe > swipeConfidenceThreshold) {
      paginate(-1);
    }
  };

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
      id: "favorite-location",
      content: (
        <>
          <h2>Your MAD Home</h2>
          <div className="stat-text">{stats.favoriteLocation.name}</div>
          <p>{stats.favoriteLocation.percentage}% of your classes were here</p>
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

  return (
    <div className="slideshow" onClick={() => paginate(1)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          className="slide"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={handleDragEnd}
        >
          {slides[currentSlide].content}
        </motion.div>
      </AnimatePresence>
      <div className="progress-dots">
        {slides.map((_, index) => (
          <div
            key={index}
            className={`dot ${index === currentSlide ? "active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentSlide(index);
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default SlideShow;