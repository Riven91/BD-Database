import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const teamAccounts = [
  { email: "artist1@local", label: "Artist 1" },
  { email: "artist2@local", label: "Artist 2" },
  { email: "artist3@local", label: "Artist 3" },
  { email: "studio@local", label: "Studio" }
];

export async function POST(request: Request) {
  const token = request.headers.get("x-setup-token");
  if (!token || token !== process.env.SETUP_TOKEN) {
    return NextResponse.json({ error: "Invalid setup token" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    accounts: teamAccounts,
    message:
      "Auth-User müssen in Supabase manuell angelegt werden. Profiles werden beim ersten Login automatisch erstellt."
  });
}
