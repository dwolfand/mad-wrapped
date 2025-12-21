import { Twilio } from "twilio";

interface StatsLinkSMSData {
  phone: string;
  firstName: string;
  clientId: string;
  studioId: string;
}

// Initialize Twilio client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
  : null;

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

/**
 * Normalize phone number to E.164 format
 * Assumes US numbers if no country code
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Add +1 if not present (US default)
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Already has country code
  return `+${digits}`;
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;

  // Basic validation - at least 10 digits
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Send SMS with stats link
 */
export async function sendStatsLinkSMS({
  phone,
  firstName,
  clientId,
  studioId,
}: StatsLinkSMSData): Promise<{ success: boolean; sid?: string; error?: string }> {
  
  if (!twilioClient) {
    console.error("Twilio client not initialized - missing credentials");
    return { 
      success: false, 
      error: "SMS service not configured" 
    };
  }

  if (!TWILIO_PHONE_NUMBER) {
    console.error("TWILIO_PHONE_NUMBER not set");
    return { 
      success: false, 
      error: "SMS phone number not configured" 
    };
  }

  const statsUrl = `https://madwrapped.com/?clientId=${clientId}`;

  // Keep message under 160 characters to avoid multi-part SMS charges
  const message = `Hi ${firstName}! Your MAD Wrapped stats are ready 🎉\n\nView your year: ${statsUrl}\n\n- MADabolic`;

  try {
    const normalizedPhone = normalizePhone(phone);

    console.log(`📱 Sending SMS to ${normalizedPhone} (original: ${phone})`);

    const result = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: normalizedPhone,
      // Enable Twilio's URL shortening to save characters and track clicks
      shortenUrls: true,
    });

    console.log(`✅ SMS sent successfully. SID: ${result.sid}`);
    
    return { 
      success: true, 
      sid: result.sid 
    };
  } catch (error: any) {
    console.error(`❌ Failed to send SMS to ${phone}:`, error);
    
    return { 
      success: false, 
      error: error.message || "Unknown error" 
    };
  }
}

