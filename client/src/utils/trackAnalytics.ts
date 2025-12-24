// API URL based on environment
const API_BASE_URL = import.meta.env.PROD
  ? "https://api.madwrapped.com"
  : "http://localhost:8280/dev";

type AnalyticsEventType =
  | "slideshow_opened"
  | "slideshow_completed"
  | "slide_view";

interface AnalyticsData {
  type: AnalyticsEventType;
  clientId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  studioId?: string;
  studio?: string;
  metadata?: Record<string, any>;
}

/**
 * Track analytics events to the backend
 */
export async function trackAnalyticsEvent(data: AnalyticsData): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/analytics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    // Silently fail - analytics shouldn't break the user experience
    console.warn("Failed to track analytics:", error);
  }
}

/**
 * Track when user opens the slideshow
 */
export function trackSlideshowOpened(
  clientId: string,
  studioId: string,
  firstName?: string
): void {
  trackAnalyticsEvent({
    type: "slideshow_opened",
    clientId,
    studioId,
    firstName,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track when user completes the slideshow (reaches last slide)
 */
export function trackSlideshowCompleted(
  clientId: string,
  studioId: string,
  firstName?: string,
  timeSpent?: number
): void {
  trackAnalyticsEvent({
    type: "slideshow_completed",
    clientId,
    studioId,
    firstName,
    metadata: {
      timestamp: new Date().toISOString(),
      timeSpent,
    },
  });
}

/**
 * Track individual slide views with duration
 */
export function trackSlideView(
  clientId: string,
  studioId: string,
  slideIndex: number,
  slideId: string,
  duration?: number
): void {
  trackAnalyticsEvent({
    type: "slide_view",
    clientId,
    studioId,
    metadata: {
      slideIndex,
      slideId,
      duration,
      timestamp: new Date().toISOString(),
    },
  });
}

