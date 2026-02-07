import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/requireUser";
import { getSupabaseServiceClient } from "@/lib/supabase/serviceServerClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, mode, error } = await requireUser(request);

    if (!user) {
      return json(
        {
          ok: false,
          error: "not_authenticated",
          mode,
          details: error?.message ?? null
        },
        401
      );
    }

    const supabase = getSupabaseServiceClient();

    const { data, error: queryError } = await supabase
      .from("contact_files")
      .select("id, file_type, file_name, file_path, created_at, note")
      .eq("contact_id", params.id)
      .order("created_at", { ascending: false });

    if (queryError) {
      return json(
        {
          ok: false,
          error: "files_query_failed",
          details: queryError.message
        },
        500
      );
    }

    return json({ ok: true, files: data ?? [] });
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: "server_error",
        details: e?.message ?? "unknown"
      },
      500
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, mode, error } = await requireUser(request);

    if (!user) {
      return json(
        {
          ok: false,
          error: "not_authenticated",
          mode,
          details: error?.message ?? null
        },
        401
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const fileType = formData.get("file_type");

    if (!(file instanceof File)) {
      return json({ ok: false, error: "file_missing" }, 400);
    }

    if (typeof fileType !== "string") {
      return json({ ok: false, error: "file_type_missing" }, 400);
    }

    const allowedTypes = ["consent", "stencil", "photo", "other"];
    if (!allowedTypes.includes(fileType)) {
      return json({ ok: false, error: "file_type_invalid" }, 400);
    }

    const supabase = getSupabaseServiceClient();
    const timestamp = Date.now();
    const fileName = file.name || "upload";
    const filePath = `contacts/${params.id}/${timestamp}_${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("crm-assets")
      .upload(filePath, file, {
        contentType: file.type || undefined
      });

    if (uploadError) {
      return json(
        {
          ok: false,
          error: "upload_failed",
          details: uploadError.message
        },
        500
      );
    }

    const { error: insertError } = await supabase.from("contact_files").insert({
      contact_id: params.id,
      file_type: fileType,
      file_name: fileName,
      file_path: filePath,
      note: null
    });

    if (insertError) {
      return json(
        {
          ok: false,
          error: "insert_failed",
          details: insertError.message
        },
        500
      );
    }

    return json({ ok: true });
  } catch (e: any) {
    return json(
      {
        ok: false,
        error: "server_error",
        details: e?.message ?? "unknown"
      },
      500
    );
  }
}
