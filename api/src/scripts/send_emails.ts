import dotenv from "dotenv";
import { sendStatsLinkEmail } from "../utils/email";

// Load environment variables
dotenv.config();

/*
SQL Query to get recipients with 100+ visits as JSON:

SELECT json_agg(
  json_build_object(
    'email', email,
    'firstName', "firstName",
    'clientId', "clientId",
    'studioId', "studioId"
  )
) as recipients
FROM (
  SELECT 
      m.email,
      m.first_name as "firstName",
      m.mindbody_id as "clientId",
      s.mindbody_id as "studioId",
      COUNT(v.id) as visit_count
  FROM members m
  JOIN studios s ON m.studio_id = s.id
  JOIN visits v ON v.member_id = m.id
  WHERE 
      m.email IS NOT NULL 
      AND m.email != ''
      AND v.cancelled = false
      AND v.class_date >= '2024-01-01'
      AND v.class_date < '2025-01-01'
      AND m.email NOT IN ('example@email.com') -- Users that have already seen their stats
  GROUP BY 
      m.email,
      m.first_name,
      m.mindbody_id,
      s.mindbody_id
  HAVING COUNT(v.id) >= 100
  ORDER BY visit_count DESC
) subquery;

-- This will output a single JSON array that you can copy directly into the recipients array below
*/

// List of recipients with their stats URLs
const recipients = [
  {
    email: "example@gmail.com",
    firstName: "David",
    clientId: "100003434",
    studioId: "5723578",
  },
  // Add more recipients here
  ,
];

async function sendBulkEmails() {
  console.log(`Starting to send ${recipients.length} emails...`);

  for (const recipient of recipients) {
    if (!recipient) {
      continue;
    }

    try {
      console.log(`Sending email to ${recipient.email}...`);
      await sendStatsLinkEmail(recipient);
      console.log(`Successfully sent email to ${recipient.email}`);

      // Add a delay between emails to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Failed to send email to ${recipient.email}:`, error);
      // Continue with next recipient even if one fails
      continue;
    }
  }

  console.log("Finished sending all emails!");
}

// Run the script
if (require.main === module) {
  sendBulkEmails().catch(console.error);
}
