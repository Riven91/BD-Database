import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { requireEnv } from "@/lib/env";

export function createRouteClient() {
  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createRouteHandlerClient({ cookies });
}
