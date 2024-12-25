export const STUDIO_MAP: Record<string, string> = {
  "5723578": "DUP",
  "480211": "ARL",
  "5723579": "ALX",
  "451879": "HST",
  "5728053": "14TH",
};

export function getStudioShortName(studioId: string): string | undefined {
  return STUDIO_MAP[studioId];
}
