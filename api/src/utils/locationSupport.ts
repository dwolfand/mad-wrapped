import { pool } from "./postgres";

// Supported locations for 2025 wrapped (DMV area only)
// These locations have accurate data and will receive the full wrapped experience
const SUPPORTED_LOCATIONS = [
  "MADabolic 14th street",
  "MADabolic Alexandria",
  "MADabolic Arlington",
  "MADabolic Dupont",
  "MADabolic H Street",
];

/**
 * Check if a location is supported for full wrapped experience
 */
export function isLocationSupported(location: string): boolean {
  return SUPPORTED_LOCATIONS.includes(location);
}

/**
 * Get the favorite location for a client by their dupont location ID
 * Returns the location where they had the most visits in 2025
 */
export async function getClientFavoriteLocation(
  dupontLocationId: string
): Promise<string | null> {
  try {
    const result = await pool.query(
      `
      SELECT location_name, COUNT(*) as visit_count
      FROM visits
      WHERE client_dupont_location_id = $1
        AND class_date >= '2025-01-01' 
        AND class_date <= '2025-12-31'
        AND NOT cancelled 
        AND NOT missed
        AND location_name IS NOT NULL
      GROUP BY location_name
      ORDER BY visit_count DESC
      LIMIT 1
    `,
      [dupontLocationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].location_name;
  } catch (error) {
    console.error(
      `Error getting favorite location for client ${dupontLocationId}:`,
      error
    );
    return null;
  }
}

/**
 * Check if a client's favorite location is supported
 * Returns true if supported, false if unsupported or if location cannot be determined
 */
export async function isClientLocationSupported(
  dupontLocationId: string
): Promise<boolean> {
  const favoriteLocation = await getClientFavoriteLocation(dupontLocationId);

  if (!favoriteLocation) {
    // If we can't determine location, default to unsupported for safety
    return false;
  }

  return isLocationSupported(favoriteLocation);
}

export { SUPPORTED_LOCATIONS };
