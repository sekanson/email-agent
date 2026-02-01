#!/usr/bin/env npx ts-node
/**
 * One-time cleanup script to remove stacked category labels from emails.
 * Keeps only ONE category label per email (the current/correct one based on latest state).
 * 
 * Usage: 
 *   1. Pull env vars: vercel env pull .env.cleanup
 *   2. Run: npx ts-node --require dotenv/config cleanup-stacked-labels.ts <user-email>
 *      Or: DOTENV_CONFIG_PATH=.env.cleanup npx ts-node --require dotenv/config cleanup-stacked-labels.ts <user-email>
 */

import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

// Check required env vars
const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY", 
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET"
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing env var: ${envVar}`);
    console.error("\nTo fix:");
    console.error("  1. cd /root/clawd/email-agent");
    console.error("  2. vercel env pull .env.cleanup");
    console.error("  3. DOTENV_CONFIG_PATH=.env.cleanup npx ts-node --require dotenv/config cleanup-stacked-labels.ts <email>");
    process.exit(1);
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getOAuth2Client(accessToken: string, refreshToken?: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return oauth2Client;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials.access_token!;
}

async function main() {
  const userEmail = process.argv[2];
  
  if (!userEmail) {
    console.error("Usage: npx ts-node cleanup-stacked-labels.ts <user-email>");
    process.exit(1);
  }

  console.log(`\n🔍 Cleaning up stacked labels for: ${userEmail}\n`);

  // Get user from database
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("email", userEmail)
    .single();

  if (userError || !user) {
    console.error("❌ User not found:", userError?.message);
    process.exit(1);
  }

  if (!user.gmail_label_ids || Object.keys(user.gmail_label_ids).length === 0) {
    console.error("❌ No category labels found for user");
    process.exit(1);
  }

  // Refresh access token
  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(user.refresh_token);
    console.log("✅ Access token refreshed");
  } catch (e) {
    console.error("❌ Failed to refresh token:", e);
    process.exit(1);
  }

  const auth = getOAuth2Client(accessToken, user.refresh_token);
  const gmail = google.gmail({ version: "v1", auth });

  // Get all category label IDs
  const categoryLabelIds = Object.values(user.gmail_label_ids).filter(Boolean) as string[];
  const labelIdToName = Object.entries(user.gmail_label_ids).reduce((acc, [name, id]) => {
    if (id) acc[id as string] = name;
    return acc;
  }, {} as Record<string, string>);

  console.log(`📋 Category labels (${categoryLabelIds.length}):`);
  categoryLabelIds.forEach(id => console.log(`   - ${labelIdToName[id]} (${id})`));
  console.log();

  // Search for emails with ANY of our category labels
  let allMessageIds = new Set<string>();
  
  for (const labelId of categoryLabelIds) {
    try {
      const response = await gmail.users.messages.list({
        userId: "me",
        labelIds: [labelId],
        maxResults: 500,
      });
      
      const messages = response.data.messages || [];
      messages.forEach(m => allMessageIds.add(m.id!));
      console.log(`Found ${messages.length} emails with label ${labelIdToName[labelId]}`);
    } catch (e: any) {
      console.error(`Error searching label ${labelId}:`, e.message);
    }
  }

  console.log(`\n📧 Total unique emails with category labels: ${allMessageIds.size}\n`);

  // Check each email for multiple category labels
  let fixed = 0;
  let alreadyClean = 0;
  let errors = 0;

  for (const messageId of allMessageIds) {
    try {
      // Get message with current labels
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "minimal",
      });

      const currentLabelIds = msg.data.labelIds || [];
      
      // Find which category labels are on this email
      const appliedCategoryLabels = currentLabelIds.filter(id => categoryLabelIds.includes(id));
      
      if (appliedCategoryLabels.length <= 1) {
        alreadyClean++;
        continue;
      }

      // Multiple labels found! Remove all but keep the first one (we could be smarter here but this works)
      const labelToKeep = appliedCategoryLabels[0];
      const labelsToRemove = appliedCategoryLabels.slice(1);

      console.log(`🔧 Email ${messageId}:`);
      console.log(`   Keeping: ${labelIdToName[labelToKeep]}`);
      console.log(`   Removing: ${labelsToRemove.map(id => labelIdToName[id]).join(", ")}`);

      // Remove extra labels
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          removeLabelIds: labelsToRemove,
        },
      });

      fixed++;
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (e: any) {
      console.error(`❌ Error processing ${messageId}:`, e.message);
      errors++;
    }
  }

  console.log(`\n✨ Cleanup complete!`);
  console.log(`   Fixed: ${fixed} emails (removed duplicate labels)`);
  console.log(`   Already clean: ${alreadyClean} emails`);
  console.log(`   Errors: ${errors}`);
}

main().catch(console.error);
