import { motion } from "framer-motion";
import { UserInfo } from "../types";
import "./IntroAnimation.css";

interface IntroAnimationProps {
  userInfo: UserInfo;
  onComplete: () => void;
}

const IntroAnimation = ({ userInfo, onComplete }: IntroAnimationProps) => {
  return (
    <motion.div
      className="intro-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onComplete}
    >
      <motion.div
        className="intro-content"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      >
        <motion.img
          src="/mad_logo.svg"
          alt="MADabolic Logo"
          className="mad-logo"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        />
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          Your MAD Wrapped Year in Review
        </motion.h1>

        <motion.div
          className="user-info"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.8 }}
        >
          <h2>{userInfo.name}</h2>
          <p>
            Member since{" "}
            {userInfo.memberSince === "Invalid Date" || !userInfo.memberSince
              ? "[a long time ago]"
              : userInfo.memberSince}
          </p>
        </motion.div>

        <motion.div
          className="start-prompt"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
        >
          Click anywhere to begin your journey
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default IntroAnimation;
