import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { WorkoutStats, ClassmateStats, LocationStats } from "../types/stats";
import "./SlideShow.css";

interface SlideShowProps {
  stats: WorkoutStats;
}

const SlideShow = ({ stats }: SlideShowProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dragDirection, setDragDirection] = useState<number>(0);
  const swipeConfidenceThreshold = 50;

  const paginate = (direction: number) => {
    setCurrentSlide((prev) => {
      const nextSlide = prev + direction;
      if (nextSlide < 0) return slides.length - 1;
      if (nextSlide >= slides.length) return 0;
      return nextSlide;
    });
  };

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      paginate(-1);
    } else if (event.key === "ArrowRight") {
      paginate(1);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (info.offset.x < -swipeConfidenceThreshold) {
      paginate(1);
    } else if (info.offset.x > swipeConfidenceThreshold) {
      paginate(-1);
    }
  };

  const handleDrag = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    setDragDirection(info.offset.x > 0 ? -1 : 1);
  };

  const slides = [
    {
      id: "total-classes",
      content: (
        <>
          <h2>Your MAD Year in Numbers</h2>
          <div className="stat-number">{stats.totalClasses}</div>
          <p>Total classes crushed</p>
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
      id: "workout-buddies",
      content: (
        <>
          <h2>Your Workout Buddies</h2>
          <div className="workout-buddies">
            {stats.peerComparison.topClassmates.map(
              (buddy: ClassmateStats, index: number) => (
                <div key={index} className="buddy-item">
                  <div className="buddy-name">{buddy.firstName}</div>
                  <div className="shared-classes">{buddy.sharedClasses}</div>
                  <p>Classes together</p>
                </div>
              )
            )}
          </div>
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
              <p>Favorite time</p>
            </div>
            <div className="pattern-item">
              <span className="highlight">{stats.mostFrequentDay}</span>
              <p>Most frequent day</p>
            </div>
            <div className="pattern-item">
              <span className="highlight">{stats.earlyBirdScore}%</span>
              <p>Early bird score</p>
            </div>
          </div>
        </>
      ),
    },
    {
      id: "streak",
      content: (
        <>
          <h2>Consistency is Key</h2>
          <div className="stat-number">{stats.longestStreak}</div>
          <p>Longest streak of classes</p>
        </>
      ),
    },
    {
      id: "favorite-location",
      content: (
        <>
          <h2>Your MAD Home</h2>
          <div className="stat-text">
            {stats.favoriteLocation.name.replace("MADabolic ", "")}
          </div>
          <p>{stats.favoriteLocation.percentage}% of your classes were here</p>
        </>
      ),
    },
    ...(stats.locationBreakdown?.length > 1
      ? [
          {
            id: "other-locations",
            content: (
              <>
                <h2>Your MAD Adventures</h2>
                <div className="other-locations">
                  {stats.locationBreakdown
                    .filter(
                      (location: LocationStats) =>
                        location.name !== stats.favoriteLocation.name
                    )
                    .map((location: LocationStats, index: number) => (
                      <div key={index} className="location-item">
                        <div className="location-name">
                          {location.name.replace("MADabolic ", "")}
                        </div>
                        <div className="location-percentage">
                          {location.count}
                        </div>
                        <p>Classes</p>
                        <div className="location-percentage-small">
                          {location.percentage}% of total
                        </div>
                      </div>
                    ))}
                </div>
              </>
            ),
          },
        ]
      : []),
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
      id: "member-comparison",
      content: (
        <>
          <h2>How You Stack Up</h2>
          <div className="percentile-grid">
            <div className="percentile-item">
              <div className="percentile-label">Total Classes</div>
              <div className="percentile-value">
                Top {100 - stats.peerComparison.percentiles.totalClasses}%
              </div>
              <div className="percentile-context">Of all members</div>
            </div>
            <div className="percentile-item">
              <div className="percentile-label">Early Bird Score</div>
              <div className="percentile-value">
                Top {100 - stats.peerComparison.percentiles.earlyBirdScore}%
              </div>
              <div className="percentile-context">Rise and grind!</div>
            </div>
            <div className="percentile-item">
              <div className="percentile-label">Monthly Consistency</div>
              <div className="percentile-value">
                Top {100 - stats.peerComparison.percentiles.classesPerMonth}%
              </div>
              <div className="percentile-context">In classes per month</div>
            </div>
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
              <p>Last-minute bookings</p>
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
    <div className="slideshow">
      <div className="slide-header">
        <img src="/mad_logo.svg" alt="MAD Logo" className="mad-logo" />
        <h1 className="year-title">{stats.firstName}'s 2024 Year in Review</h1>
      </div>
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={currentSlide}
          className="slide-container"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={handleDragEnd}
          onDrag={handleDrag}
          initial={{
            x: dragDirection > 0 ? 1000 : -1000,
            opacity: 0,
          }}
          animate={{ x: 0, opacity: 1 }}
          exit={{
            x: dragDirection > 0 ? -1000 : 1000,
            opacity: 0,
          }}
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
        >
          <div className="slide">{slides[currentSlide].content}</div>
        </motion.div>
      </AnimatePresence>
      <div className="progress-dots">
        {slides.map((_, index) => (
          <div
            key={index}
            className={`dot ${currentSlide === index ? "active" : ""}`}
            onClick={() => setCurrentSlide(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default SlideShow;
