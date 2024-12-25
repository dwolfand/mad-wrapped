import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION || "us-east-1" });

interface StatsLinkEmailData {
  email: string;
  firstName: string;
  clientId: string;
  studioId: string;
}

export async function sendStatsLinkEmail({
  email,
  firstName,
  clientId,
  studioId,
}: StatsLinkEmailData) {
  const statsUrl = `https://madwrapped.com/?clientId=${clientId}&studioId=${studioId}`;

  const params = {
    Source: "MAD Wrapped <no-reply@madwrapped.com>",
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: "Your MAD Wrapped Stats Are Ready! 🎉",
      },
      Body: {
        Html: {
          Data: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1>Hi ${firstName}! 👋</h1>
              <p>Your MAD Wrapped stats are ready to view!</p>
              <p>Click the button below to see your personalized workout journey:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${statsUrl}" 
                   style="background-color: #FF4B2B; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 5px; font-weight: bold;">
                  View My Stats
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
        },
      },
    },
  };

  try {
    await ses.send(new SendEmailCommand(params));
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
