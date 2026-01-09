import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { CoachStats } from "../types/coachStats";
import { trackSlideshowOpened } from "../utils/trackAnalytics";
import "./SlideShow.css";

interface CoachSlideShowProps {
  stats: CoachStats;
}

const CoachSlideShow = ({ stats }: CoachSlideShowProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dragDirection, setDragDirection] = useState<number>(0);
  const slideRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const slideStartTimeRef = useRef<number>(Date.now());
  const hasTrackedCompletionRef = useRef(false);
  const swipeConfidenceThreshold = 50;

  // Track slideshow opened on mount
  useEffect(() => {
    trackSlideshowOpened(
      stats.coachFullName,
      "coach",
      stats.coachFirstName
    );
    startTimeRef.current = Date.now();
  }, [stats.coachFirstName, stats.coachFullName]);

  const slides = [
    {
      title: "Welcome Coach! 🎉",
      content: (
        <div className="slide-content">
          <h1 className="slide-title-large">
            {stats.coachFirstName}'s
            <br />
            Coach Wrapped
          </h1>
          <p className="slide-subtitle">Your 2025 Impact Report</p>
          <div className="stat-highlight">
            <p className="stat-number">{stats.totalClasses.toLocaleString()}</p>
            <p className="stat-label">Classes Coached</p>
          </div>
          <p className="slide-footer">Swipe to see your year in review →</p>
        </div>
      ),
    },
    {
      title: "Your Impact",
      content: (
        <div className="slide-content">
          <h2 className="slide-title">Your Impact 💪</h2>
          <div className="stat-grid">
            <div className="stat-box">
              <p className="stat-number">{stats.uniqueStudents}</p>
              <p className="stat-label">Unique Students</p>
            </div>
            <div className="stat-box">
              <p className="stat-number">{stats.totalStudentVisits.toLocaleString()}</p>
              <p className="stat-label">Total Student Visits</p>
            </div>
          </div>
          <div className="insight-box">
            <p className="insight-text">
              You made a difference in the lives of{" "}
              <strong>{stats.uniqueStudents}</strong> athletes this year!
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Teaching Hours",
      content: (
        <div className="slide-content">
          <h2 className="slide-title">Time in the Trenches ⏰</h2>
          <div className="stat-highlight">
            <p className="stat-number">{stats.totalTeachingHours.toLocaleString()}</p>
            <p className="stat-label">Hours of Coaching</p>
          </div>
          <div className="insight-box">
            <p className="insight-text">
              That's {Math.round(stats.totalTeachingHours / 24)} days of pure
              coaching excellence!
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Average Class Size",
      content: (
        <div className="slide-content">
          <h2 className="slide-title">Your Classes 👥</h2>
          <div className="stat-highlight">
            <p className="stat-number">{stats.averageClassSize.toFixed(1)}</p>
            <p className="stat-label">Average Class Size</p>
          </div>
          <div className="insight-box">
            <p className="insight-text">
              You brought the energy to an average of{" "}
              <strong>{Math.round(stats.averageClassSize)}</strong> athletes per
              class!
            </p>
          </div>
        </div>
      ),
    },
  ];

  // Add locations slide if coach taught at multiple locations
  if (stats.locations.length > 1) {
    slides.push({
      title: "Your Locations",
      content: (
        <div className="slide-content">
          <h2 className="slide-title">Your Studios 🏢</h2>
          <p className="slide-subtitle">
            You coached at {stats.locations.length} different locations!
          </p>
          <div className="location-list">
            {stats.locations.map((location, index) => (
              <div key={index} className="location-item">
                <div className="location-info">
                  <span className="location-name">{location.name}</span>
                  <span className="location-count">
                    {location.classCount} classes
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${location.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  // Add favorite time slot
  slides.push({
    title: "Favorite Time Slot",
    content: (
      <div className="slide-content">
        <h2 className="slide-title">Your Prime Time 🕐</h2>
        <div className="stat-highlight">
          <p className="stat-number-text">{stats.favoriteTimeSlot.timeSlot}</p>
          <p className="stat-label">Your Most Common Time Slot</p>
        </div>
        <div className="insight-box">
          <p className="insight-text">
            You coached {stats.favoriteTimeSlot.classCount} classes during this
            time - that's {stats.favoriteTimeSlot.percentage.toFixed(1)}% of
            your classes!
          </p>
        </div>
      </div>
    ),
  });

  // Add special badges
  const badges = [];
  if (stats.earlyMorningWarrior) {
    badges.push({
      emoji: "🌅",
      title: "Early Morning Warrior",
      description: "You owned the early morning classes!",
    });
  }
  if (stats.lateNightHero) {
    badges.push({
      emoji: "🌙",
      title: "Late Night Hero",
      description: "You dominated the evening sessions!",
    });
  }
  if (stats.studentRetentionRate >= 80) {
    badges.push({
      emoji: "⭐",
      title: "Student Favorite",
      description: `${stats.studentRetentionRate.toFixed(1)}% of students came back!`,
    });
  }

  if (badges.length > 0) {
    slides.push({
      title: "Your Badges",
      content: (
        <div className="slide-content">
          <h2 className="slide-title">Your Achievements 🏆</h2>
          <div className="badges-grid">
            {badges.map((badge, index) => (
              <div key={index} className="badge-card">
                <div className="badge-emoji">{badge.emoji}</div>
                <h3 className="badge-title">{badge.title}</h3>
                <p className="badge-description">{badge.description}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  // Add busiest month
  slides.push({
    title: "Busiest Month",
    content: (
      <div className="slide-content">
        <h2 className="slide-title">Your Busiest Month 📅</h2>
        <div className="stat-highlight">
          <p className="stat-number-text">{stats.busiestMonth.month}</p>
          <p className="stat-label">Most Classes Coached</p>
        </div>
        <div className="stat-grid">
          <div className="stat-box">
            <p className="stat-number">{stats.busiestMonth.classCount}</p>
            <p className="stat-label">Classes</p>
          </div>
          <div className="stat-box">
            <p className="stat-number">{stats.busiestMonth.uniqueStudents}</p>
            <p className="stat-label">Unique Students</p>
          </div>
        </div>
      </div>
    ),
  });

  // Add favorite day
  slides.push({
    title: "Favorite Day",
    content: (
      <div className="slide-content">
        <h2 className="slide-title">Your Favorite Day 📆</h2>
        <div className="stat-highlight">
          <p className="stat-number-text">{stats.mostPopularDay}</p>
          <p className="stat-label">Most Classes Coached</p>
        </div>
        <div className="insight-box">
          <p className="insight-text">
            {stats.mostPopularDay}s were your day to shine!
          </p>
        </div>
      </div>
    ),
  });

  // Add class type breakdown
  const classTypes = [
    { name: "Durability", count: stats.totalDurabilityClasses, emoji: "🏋️" },
    { name: "Anaerobic", count: stats.totalAnaerobicClasses, emoji: "💨" },
    { name: "Momentum", count: stats.totalMomentumClasses, emoji: "⚡" },
    { name: "Deload", count: stats.totalDeloadClasses, emoji: "🧘" },
  ].filter((type) => type.count > 0);

  if (classTypes.length > 0) {
    const totalClassTypes = classTypes.reduce((sum, type) => sum + type.count, 0);
    slides.push({
      title: "Class Types",
      content: (
        <div className="slide-content">
          <h2 className="slide-title">Your Class Mix 🎯</h2>
          <div className="class-types-grid">
            {classTypes.map((type, index) => (
              <div key={index} className="class-type-card">
                <div className="class-type-emoji">{type.emoji}</div>
                <h3 className="class-type-name">{type.name}</h3>
                <p className="class-type-count">{type.count} classes</p>
                <p className="class-type-percentage">
                  {((type.count / totalClassTypes) * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  // Add teaching streak
  if (stats.longestTeachingStreak > 1) {
    slides.push({
      title: "Teaching Streak",
      content: (
        <div className="slide-content">
          <h2 className="slide-title">Your Longest Streak 🔥</h2>
          <div className="stat-highlight">
            <p className="stat-number">{stats.longestTeachingStreak}</p>
            <p className="stat-label">Consecutive Days Teaching</p>
          </div>
          <div className="insight-box">
            <p className="insight-text">
              You showed up {stats.longestTeachingStreak} days in a row - that's
              dedication!
            </p>
          </div>
        </div>
      ),
    });
  }

  // Add top students
  if (stats.topStudents.length > 0) {
    slides.push({
      title: "Your Top Students",
      content: (
        <div className="slide-content">
          <h2 className="slide-title">Your Regulars 🌟</h2>
          <p className="slide-subtitle">
            These athletes showed up the most to your classes
          </p>
          <div className="top-students-list">
            {stats.topStudents.slice(0, 5).map((student, index) => (
              <div key={index} className="student-card">
                <div className="student-rank">#{index + 1}</div>
                <div className="student-info">
                  <p className="student-name">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="student-count">
                    {student.totalClasses} classes with you
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  // Add student retention
  slides.push({
    title: "Student Retention",
    content: (
      <div className="slide-content">
        <h2 className="slide-title">They Came Back! 🎯</h2>
        <div className="stat-highlight">
          <p className="stat-number">{stats.studentRetentionRate.toFixed(1)}%</p>
          <p className="stat-label">Student Retention Rate</p>
        </div>
        <div className="insight-box">
          <p className="insight-text">
            {stats.studentRetentionRate >= 80
              ? "Amazing! Your students love coming back to your classes!"
              : stats.studentRetentionRate >= 60
              ? "Great job! Your students are coming back for more!"
              : "Keep building those relationships - they'll come back!"}
          </p>
        </div>
      </div>
    ),
  });


  // Add final recap slide
  slides.push({
    title: "Year in Review",
    content: (
      <div className="slide-content">
        <h2 className="slide-title">2025 Recap 🎊</h2>
        <div className="recap-stats">
          <div className="recap-stat">
            <p className="recap-number">{stats.totalClasses}</p>
            <p className="recap-label">Classes Coached</p>
          </div>
          <div className="recap-stat">
            <p className="recap-number">{stats.uniqueStudents}</p>
            <p className="recap-label">Athletes Inspired</p>
          </div>
          <div className="recap-stat">
            <p className="recap-number">{stats.totalTeachingHours.toLocaleString()}</p>
            <p className="recap-label">Hours of Coaching</p>
          </div>
        </div>
        <div className="final-message">
          <p>
            Thank you for an incredible year, {stats.coachFirstName}! Your
            dedication and passion have made a lasting impact on so many athletes.
          </p>
          <p className="final-emoji">🙏 💪 🎉</p>
        </div>
      </div>
    ),
  });

  const paginate = (newDirection: number) => {
    // Track slide view (commented out for now)
    // const slideViewDuration = Date.now() - slideStartTimeRef.current;
    // if (currentSlide < slides.length) {
    //   trackSlideView(
    //     stats.coachFullName,
    //     "coach",
    //     currentSlide,
    //     slides[currentSlide].title,
    //     slideViewDuration
    //   );
    // }

    slideStartTimeRef.current = Date.now();

    if (newDirection === 1 && currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else if (newDirection === -1 && currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }

    // Track completion on last slide (commented out for now)
    if (
      newDirection === 1 &&
      currentSlide === slides.length - 1 &&
      !hasTrackedCompletionRef.current
    ) {
      // const totalDuration = Date.now() - startTimeRef.current;
      // trackSlideshowCompleted(stats.coachFullName, "coach", totalDuration);
      hasTrackedCompletionRef.current = true;
    }
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const swipe = Math.abs(info.offset.x);
    const swipeVelocity = Math.abs(info.velocity.x);

    if (swipe > swipeConfidenceThreshold || swipeVelocity > 500) {
      if (info.offset.x > 0) {
        paginate(-1);
      } else {
        paginate(1);
      }
    }
  };

  const handleDrag = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    setDragDirection(info.offset.x > 0 ? -1 : 1);
  };

  return (
    <div className="slideshow">
      <div className="slide-header">
        <img src="/mad_logo.svg" alt="MAD Logo" className="mad-logo" />
        <h1 className="year-title">
          Coach {stats.coachFirstName}'s 2025 Year in Review
        </h1>
      </div>
      <motion.div
        className="slide-container"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        onClick={() => paginate(1)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            ref={slideRef}
            className="slide"
            initial={{ opacity: 0, x: 50 * dragDirection }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 * dragDirection }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            whileTap={{ cursor: "grabbing" }}
          >
            {slides[currentSlide].content}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <motion.div
        className="progress-dots"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {slides.map((_, index) => (
          <div
            key={index}
            className={`dot ${index === currentSlide ? "active" : ""}`}
            onClick={() => {
              if (index !== currentSlide) {
                setCurrentSlide(index);
                slideStartTimeRef.current = Date.now();
              }
            }}
          />
        ))}
      </motion.div>

      <div className="slide-counter">
        {currentSlide + 1} / {slides.length}
      </div>
    </div>
  );
};

export default CoachSlideShow;


