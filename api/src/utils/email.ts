import sgMail from "@sendgrid/mail";

interface StatsLinkEmailData {
  email: string;
  firstName: string;
  clientId: string;
  studioId: string;
}

// Initialize SendGrid with API key
if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is required");
}
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Hi ${firstName}! 👋</h1>
        <p>Your MAD Wrapped stats are ready to view!</p>
        <p>Click the button below to see your personalized workout journey:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${statsUrl}" 
             style="background-color: #06C7A6; color: black; padding: 12px 24px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold;">
            View My Year in Review
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p>${statsUrl}</p>
        <p>Enjoy reliving your fitness journey!</p>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          This email was sent by MAD Wrapped. If you didn't request this, you can ignore this email.
        </p>
      </div>
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
