import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { 
  refreshAccessToken, 
  deleteFilter,
  getFilters,
  searchMessages,
  modifyMessage,
  getMessage
} from "@/lib/gmail";

const FOCUS_QUEUE_LABEL = "📵 Focus Queue";

export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json();

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", userEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user settings for focus mode info
    let { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_email", userEmail)
      .single();

    if (!settings) {
      const result = await supabase
        .from("user_settings")
        .select("*")
        .eq("email", userEmail)
        .single();
      settings = result.data;
    }

    // Refresh token
    let accessToken = user.access_token;
    try {
      accessToken = await refreshAccessToken(user.refresh_token);
      await supabase
        .from("users")
        .update({ access_token: accessToken })
        .eq("email", userEmail);
    } catch (e) {
      console.error("Token refresh failed:", e);
    }

    // Step 1: Delete the focus mode filter
    const filterId = settings?.focus_mode_filter_id;
    if (filterId) {
      try {
        await deleteFilter(accessToken, user.refresh_token, filterId);
        console.log(`Deleted focus mode filter: ${filterId}`);
      } catch (e: any) {
        // Filter might already be deleted
        console.log(`Filter deletion note: ${e.message}`);
      }
    } else {
      // Try to find and delete any focus-mode-like filters
      const filters = await getFilters(accessToken, user.refresh_token);
      const focusFilter = filters.find(f => 
        f.criteria?.query === "-from:me" && 
        f.action?.removeLabelIds?.includes("INBOX")
      );
      if (focusFilter) {
        await deleteFilter(accessToken, user.refresh_token, focusFilter.id);
        console.log(`Deleted orphan focus filter: ${focusFilter.id}`);
      }
    }

    // Step 2: Find all emails in Focus Queue
    const focusLabelId = settings?.focus_mode_label_id;
    let queuedEmails: any[] = [];
    let summary = {
      total: 0,
      byCategory: {} as Record<string, number>,
      importantEmails: [] as any[],
    };

    if (focusLabelId) {
      // Search for emails with Focus Queue label
      const messageIds = await searchMessages(
        accessToken, 
        user.refresh_token, 
        `label:${FOCUS_QUEUE_LABEL.replace(/ /g, "-")}`
      );

      console.log(`Found ${messageIds.length} emails in Focus Queue`);

      // Get details for each email and move to inbox
      for (const msgId of messageIds) {
        try {
          // Get email details
          const email = await getMessage(accessToken, user.refresh_token, msgId);
          
          // Move to inbox: add INBOX label, remove Focus Queue label
          await modifyMessage(accessToken, user.refresh_token, msgId, {
            addLabelIds: ["INBOX"],
            removeLabelIds: [focusLabelId],
          });

          // Get category from email labels (our Zeno labels)
          const labels = email.labelIds || [];
          const categoryLabels = labels.filter((l: string) => 
            user.gmail_label_ids && Object.values(user.gmail_label_ids).includes(l)
          );
          
          // Find category name from label
          let categoryName = "Uncategorized";
          if (user.gmail_label_ids && categoryLabels.length > 0) {
            for (const [name, id] of Object.entries(user.gmail_label_ids)) {
              if (id === categoryLabels[0]) {
                categoryName = name;
                break;
              }
            }
          }

          // Count by category
          summary.byCategory[categoryName] = (summary.byCategory[categoryName] || 0) + 1;
          summary.total++;

          // Extract email details
          const headers = email.payload?.headers || [];
          const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
          
          const emailInfo = {
            id: msgId,
            subject: getHeader("Subject"),
            from: getHeader("From"),
            date: getHeader("Date"),
            category: categoryName,
            snippet: email.snippet,
          };

          queuedEmails.push(emailInfo);

          // Track important emails (Action Required)
          if (categoryName.toLowerCase().includes("action") || categoryName.toLowerCase().includes("required")) {
            summary.importantEmails.push(emailInfo);
          }

        } catch (e: any) {
          console.error(`Failed to process email ${msgId}:`, e.message);
        }
      }
    }

    // Step 3: Update user settings
    await supabase
      .from("user_settings")
      .update({
        focus_mode_enabled: false,
        focus_mode_until: null,
        focus_mode_filter_id: null,
        focus_mode_ended_at: new Date().toISOString(),
      })
      .eq("user_email", userEmail);

    // Step 4: Generate summary message
    let summaryMessage = "";
    const focusStarted = settings?.focus_mode_started_at 
      ? new Date(settings.focus_mode_started_at)
      : null;
    const focusDuration = focusStarted 
      ? Math.round((Date.now() - focusStarted.getTime()) / (1000 * 60 * 60 * 10)) / 10
      : null;

    if (summary.total === 0) {
      summaryMessage = "🎯 **You stayed focused and missed nothing!**\n\nNo new emails came in while you were in focus mode.";
    } else {
      const categoryBreakdown = Object.entries(summary.byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => `• ${count} ${cat}`)
        .join("\n");

      summaryMessage = `📬 **Focus Mode Summary**\n\n`;
      summaryMessage += `While you were focused${focusDuration ? ` (${focusDuration}h)` : ""}, you received **${summary.total} email${summary.total > 1 ? 's' : ''}**:\n\n`;
      summaryMessage += categoryBreakdown;

      if (summary.importantEmails.length > 0) {
        summaryMessage += `\n\n🚨 **Needs Your Attention:**\n`;
        for (const email of summary.importantEmails.slice(0, 3)) {
          const fromName = email.from.split("<")[0].trim() || email.from;
          summaryMessage += `\n• **${email.subject}**\n  From: ${fromName}\n  ${email.snippet?.slice(0, 100)}...`;
        }
      }

      summaryMessage += `\n\nAll emails have been moved back to your inbox.`;
    }

    return NextResponse.json({
      success: true,
      message: "Focus mode ended",
      summary: {
        ...summary,
        message: summaryMessage,
        focusDurationHours: focusDuration,
      },
      emailsRestored: summary.total,
    });

  } catch (error: any) {
    console.error("Error ending focus mode:", error);
    return NextResponse.json(
      { error: `Failed to end focus mode: ${error.message}` },
      { status: 500 }
    );
  }
}
