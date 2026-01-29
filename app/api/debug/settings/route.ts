import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userEmail = searchParams.get("userEmail");

  if (!userEmail) {
    return NextResponse.json({ error: "userEmail required" }, { status: 400 });
  }

  const supabase = createClient();

  // Get raw settings from database
  let { data: settings, error } = await supabase
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
    error = result.error;
  }

  // Get table columns info
  const { data: tableInfo } = await supabase
    .rpc('get_table_columns', { table_name: 'user_settings' })
    .single();

  return NextResponse.json({
    userEmail,
    settings: settings || null,
    error: error?.message || null,
    hasCategories: !!settings?.categories,
    categoryNames: settings?.categories 
      ? Object.values(settings.categories).map((c: any) => c.name) 
      : null,
    hasSchemaVersions: !!settings?.schemaVersions,
    schemaVersions: settings?.schemaVersions || null,
    tableInfo: tableInfo || "Could not fetch table info",
  });
}
