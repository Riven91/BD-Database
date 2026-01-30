"use client";

import { getPlainSupabaseBrowser } from "@/lib/supabase/plainBrowserClient";

export function supabaseBrowser() {
  return getPlainSupabaseBrowser();
}
