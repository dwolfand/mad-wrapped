// Extend the window interface to include gtag
declare global {
  interface Window {
    gtag: (
      command: string,
      action: string,
      params?: { [key: string]: any }
    ) => void;
  }
}

// Set user properties in GA4
export const setUserProperties = (clientId: string) => {
  window.gtag?.("set", "user_properties", {
    client_id: clientId,
  });
};

// Track view event
export const trackView = (clientId: string) => {
  window.gtag?.("event", "wrapped_view", {
    client_id: clientId,
  });
};

// Track share event
export const trackShare = (clientId: string, platform: string) => {
  window.gtag?.("event", "wrapped_share", {
    client_id: clientId,
    platform: platform,
  });
};