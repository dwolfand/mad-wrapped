import sgMail from "@sendgrid/mail";
import { getStudioShortName } from "./studios";

interface StatsLinkEmailData {
  email: string;
  firstName: string;
  clientId: string;
  studioId: string;
}

interface NotificationRequestData {
  email: string;
  firstName: string;
  lastName: string;
  studio: string;
  isCustomStudio: boolean;
}

// Initialize SendGrid with API key
if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is required");
}
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function sendAdminNotification({
  email,
  firstName,
  lastName,
  studio,
  isCustomStudio,
}: NotificationRequestData) {
  const studioShortName = !isCustomStudio
    ? getStudioShortName(studio)
    : undefined;
  const studioDisplay = isCustomStudio
    ? `${studio} (Custom)`
    : `${studio} (${studioShortName || "Unknown"})`;

  const msg = {
    to: "dwolfand@gmail.com",
    from: "MAD Wrapped <no-reply@madwrapped.com>",
    subject: "New MAD Wrapped Notification Request",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0;">
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="margin: 0 0 20px 0;">New Notification Request</h1>
            <p style="margin: 0 0 10px 0;"><strong>Name:</strong> ${firstName} ${lastName}</p>
            <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0 0 10px 0;"><strong>Studio:</strong> ${studioDisplay}</p>
            <p style="margin: 20px 0 0 0;">Please pull their data when ready.</p>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error("Error sending admin notification:", error);
    // Don't throw the error as this is a background notification
    return false;
  }
}

export async function sendStatsLinkEmail({
  email,
  firstName,
  clientId,
  studioId,
}: StatsLinkEmailData) {
  const statsUrl = `https://madwrapped.com/?clientId=${clientId}&studioId=${studioId}`;

  const msg = {
    to: email,
    from: "MAD Wrapped <no-reply@madwrapped.com>",
    subject: "Your MAD Wrapped Stats Are Ready! 🎉",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0;">
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; padding: 20px;">
              <img src="https://madwrapped.com/images/email/mad_logo.png" 
                   alt="MADabolic" 
                   style="width: 200px; height: auto;" />
            </div>
            <img src="https://madwrapped.com/images/email/email-header.jpg" 
                 alt="MAD Wrapped" 
                 style="width: 100%; height: auto; display: block; max-width: 600px;" />
            <div style="padding: 40px 20px;">
              <h1 style="margin: 0 0 20px 0;">Hi ${firstName}! 👋</h1>
              <p style="margin: 0 0 20px 0;">Your MAD Wrapped stats are ready to view!</p>
              <p style="margin: 0 0 30px 0;">Click the button below to see your personalized workout journey:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${statsUrl}" 
                   style="background-color: #06C7A6; color: black; padding: 12px 24px; 
                          text-decoration: none; border-radius: 5px; font-weight: bold; 
                          display: inline-block;">
                  View My Year in Review
                </a>
              </div>
              <p style="margin: 20px 0 10px 0;">Or copy and paste this link into your browser:</p>
              <p style="margin: 0 0 30px 0; color: #06C7A6;">${statsUrl}</p>
              <p style="margin: 0;">Enjoy reliving your fitness journey!</p>
              <hr style="margin: 30px 0; border: none; height: 1px; background-color: rgba(0, 0, 0, 0.1);">
              <p style="color: #888888; font-size: 12px; margin: 0;">
                This email was sent by MAD Wrapped. If you didn't request this, you can ignore this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
