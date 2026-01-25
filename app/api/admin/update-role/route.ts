import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

// Role hierarchy for permission checks
const ROLE_HIERARCHY = {
  user: 0,
  admin: 1,
  owner: 2,
  primary_owner: 3,
};

type Role = keyof typeof ROLE_HIERARCHY;

export async function POST(request: NextRequest) {
  try {
    const { requesterEmail, targetUserId, newRole } = await request.json();

    if (!requesterEmail || !targetUserId || !newRole) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate role
    if (!Object.keys(ROLE_HIERARCHY).includes(newRole)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get the requester's role
    const { data: requester, error: requesterError } = await supabase
      .from("users")
      .select("role")
      .eq("email", requesterEmail)
      .single();

    if (requesterError || !requester) {
      return NextResponse.json(
        { error: "Requester not found" },
        { status: 404 }
      );
    }

    const requesterRole = (requester.role || "user") as Role;
    const requesterLevel = ROLE_HIERARCHY[requesterRole];

    // Check if requester can manage roles (must be owner or primary_owner)
    if (requesterLevel < ROLE_HIERARCHY.owner) {
      return NextResponse.json(
        { error: "You don't have permission to manage roles" },
        { status: 403 }
      );
    }

    // Get the target user's current role
    const { data: targetUser, error: targetError } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("id", targetUserId)
      .single();

    if (targetError || !targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 }
      );
    }

    const targetCurrentRole = (targetUser.role || "user") as Role;
    const targetCurrentLevel = ROLE_HIERARCHY[targetCurrentRole];
    const newRoleLevel = ROLE_HIERARCHY[newRole as Role];

    // Cannot demote or change primary_owner
    if (targetCurrentRole === "primary_owner") {
      return NextResponse.json(
        { error: "Cannot modify primary owner's role" },
        { status: 403 }
      );
    }

    // Cannot demote yourself
    if (targetUser.email === requesterEmail && newRoleLevel < requesterLevel) {
      return NextResponse.json(
        { error: "Cannot demote yourself" },
        { status: 403 }
      );
    }

    // Only primary_owner can assign owner or primary_owner roles
    if (newRoleLevel >= ROLE_HIERARCHY.owner && requesterRole !== "primary_owner") {
      return NextResponse.json(
        { error: "Only primary owner can assign owner roles" },
        { status: 403 }
      );
    }

    // Cannot assign a role higher than your own (except primary_owner can do anything)
    if (newRoleLevel > requesterLevel && requesterRole !== "primary_owner") {
      return NextResponse.json(
        { error: "Cannot assign a role higher than your own" },
        { status: 403 }
      );
    }

    // SPECIAL CASE: Only ONE primary_owner allowed
    // When assigning primary_owner, transfer it (demote current primary_owner to owner)
    if (newRole === "primary_owner") {
      // Find current primary_owner and demote to owner
      const { error: demoteError } = await supabase
        .from("users")
        .update({
          role: "owner",
          updated_at: new Date().toISOString(),
        })
        .eq("role", "primary_owner");

      if (demoteError) {
        console.error("Failed to demote current primary owner:", demoteError);
        return NextResponse.json(
          { error: "Failed to transfer primary owner role" },
          { status: 500 }
        );
      }
    }

    // Update the user's role
    const { error: updateError } = await supabase
      .from("users")
      .update({
        role: newRole,
        // Also update is_admin for backwards compatibility
        is_admin: newRoleLevel >= ROLE_HIERARCHY.admin,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (updateError) {
      console.error("Failed to update role:", updateError);
      return NextResponse.json(
        { error: "Failed to update role" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Role updated to ${newRole}`,
    });
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json(
      { error: "Failed to update role" },
      { status: 500 }
    );
  }
}
