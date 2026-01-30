"use client";

import { useRouter } from "next/navigation";
import { getPlainSupabaseBrowser } from "@/lib/supabase/plainBrowserClient";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = getPlainSupabaseBrowser();

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <button
      onClick={onLogout}
      className="rounded border border-green-700 px-3 py-2 text-sm hover:bg-green-950"
    >
      Logout
    </button>
  );
}
