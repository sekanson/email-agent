import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import {
  getPendingActions,
  getActionHistory,
  approveAction,
  cancelAction,
} from "@/lib/action-queue";

/**
 * GET /api/zeno/actions
 * 
 * Get actions for a user (pending or history)
 * 
 * Query params:
 * - userEmail: string (required)
 * - status: 'pending' | 'history' | 'all' (default: 'pending')
 * - limit: number (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get("userEmail");
    const status = searchParams.get("status") || "pending";
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    let actions;

    if (status === "pending") {
      actions = await getPendingActions(userEmail);
    } else if (status === "history") {
      actions = await getActionHistory(userEmail, limit);
    } else {
      // Get all
      const supabase = createClient();
      const { data, error } = await supabase
        .from("action_queue")
        .select("*")
        .eq("user_email", userEmail)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      actions = data;
    }

    // Group by status for stats
    const stats = {
      pending: 0,
      approved: 0,
      executing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    actions?.forEach((action: any) => {
      if (stats[action.status as keyof typeof stats] !== undefined) {
        stats[action.status as keyof typeof stats]++;
      }
    });

    return NextResponse.json({
      success: true,
      actions: actions || [],
      stats,
    });
  } catch (error) {
    console.error("Error fetching actions:", error);
    return NextResponse.json(
      { error: "Failed to fetch actions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/zeno/actions
 * 
 * Approve or cancel an action
 * 
 * Body: {
 *   actionId: string,
 *   operation: 'approve' | 'cancel'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { actionId, operation } = await request.json();

    if (!actionId || !operation) {
      return NextResponse.json(
        { error: "actionId and operation are required" },
        { status: 400 }
      );
    }

    if (operation === "approve") {
      const action = await approveAction(actionId, "dashboard");
      return NextResponse.json({
        success: true,
        action,
        message: "Action approved",
      });
    } else if (operation === "cancel") {
      await cancelAction(actionId);
      return NextResponse.json({
        success: true,
        message: "Action cancelled",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid operation. Use 'approve' or 'cancel'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error updating action:", error);
    return NextResponse.json(
      { error: "Failed to update action" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/zeno/actions
 * 
 * Clear old/expired actions
 * 
 * Query params:
 * - userEmail: string (required)
 * - status: string (optional - only delete actions with this status)
 * - olderThan: string (optional - ISO date, only delete older than this)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get("userEmail");
    const status = searchParams.get("status");
    const olderThan = searchParams.get("olderThan");

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    let query = supabase
      .from("action_queue")
      .delete()
      .eq("user_email", userEmail);

    if (status) {
      query = query.eq("status", status);
    }

    if (olderThan) {
      query = query.lt("created_at", olderThan);
    }

    const { error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      deleted: count || 0,
      message: `Deleted ${count || 0} actions`,
    });
  } catch (error) {
    console.error("Error deleting actions:", error);
    return NextResponse.json(
      { error: "Failed to delete actions" },
      { status: 500 }
    );
  }
}
