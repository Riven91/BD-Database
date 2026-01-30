"use client";

import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClientComponentClient();

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
