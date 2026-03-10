import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing Authorization header");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Verify the user's token by calling Supabase auth
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: supabaseAnonKey,
    },
  });

  if (!res.ok) throw new Error("Invalid or expired token");
  const user = await res.json();
  return user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    await verifyAuth(req);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Admin client that bypasses RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const path = url.pathname.split("/face-db-proxy")[1] || "/";
    const method = req.method;

    // ─── GET /embeddings?section_id=xxx ───
    // Returns all face embeddings for students in a given section
    if (method === "GET" && path.startsWith("/embeddings")) {
      const sectionId = url.searchParams.get("section_id");
      if (!sectionId) return jsonResponse({ error: "section_id required" }, 400);

      // Get students in this section with face embeddings
      const { data: students, error: studentsErr } = await supabase
        .from("students")
        .select("id, roll_number, full_name, face_embedding_id")
        .eq("section_id", sectionId)
        .eq("face_registered", true)
        .not("face_embedding_id", "is", null);

      if (studentsErr) return jsonResponse({ error: studentsErr.message }, 500);
      if (!students || students.length === 0) {
        return jsonResponse({ students: [], embeddings: [] });
      }

      // Get the embeddings
      const embeddingIds = students.map((s) => s.face_embedding_id).filter(Boolean);
      const { data: embeddings, error: embErr } = await supabase
        .from("face_embeddings")
        .select("*")
        .in("id", embeddingIds);

      if (embErr) return jsonResponse({ error: embErr.message }, 500);

      return jsonResponse({ students, embeddings });
    }

    // ─── POST /embeddings ───
    // Store a face embedding and link it to a student
    if (method === "POST" && path === "/embeddings") {
      const body = await req.json();
      const { student_id, embedding, embedding_id } = body;

      if (!student_id || !embedding || !embedding_id) {
        return jsonResponse({ error: "student_id, embedding, and embedding_id are required" }, 400);
      }

      // Upsert the embedding
      const { error: embError } = await supabase
        .from("face_embeddings")
        .upsert({ id: embedding_id, embedding }, { onConflict: "id" });

      if (embError) return jsonResponse({ error: embError.message }, 500);

      // Update the student record
      const { error: studentError } = await supabase
        .from("students")
        .update({
          face_registered: true,
          face_embedding_id: embedding_id,
        })
        .eq("id", student_id);

      if (studentError) return jsonResponse({ error: studentError.message }, 500);

      return jsonResponse({ success: true, embedding_id });
    }

    // ─── DELETE /embeddings?embedding_id=xxx ───
    // Remove a face embedding
    if (method === "DELETE" && path.startsWith("/embeddings")) {
      const embeddingId = url.searchParams.get("embedding_id");
      if (!embeddingId) return jsonResponse({ error: "embedding_id required" }, 400);

      const { error } = await supabase
        .from("face_embeddings")
        .delete()
        .eq("id", embeddingId);

      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ success: true });
    }

    // ─── GET /students?section_id=xxx ───
    // Get all students in a section (for recognition matching)
    if (method === "GET" && path.startsWith("/students")) {
      const sectionId = url.searchParams.get("section_id");
      if (!sectionId) return jsonResponse({ error: "section_id required" }, 400);

      const { data, error } = await supabase
        .from("students")
        .select("id, roll_number, full_name, face_registered, face_embedding_id, section_id")
        .eq("section_id", sectionId);

      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ students: data });
    }

    // ─── POST /attendance ───
    // Mark attendance for recognized students
    if (method === "POST" && path === "/attendance") {
      const body = await req.json();
      const { records } = body; // Array of { class_id, student_id, status, face_confidence, marked_by }

      if (!records || !Array.isArray(records)) {
        return jsonResponse({ error: "records array required" }, 400);
      }

      const { data, error } = await supabase
        .from("attendance")
        .upsert(
          records.map((r: any) => ({
            class_id: r.class_id,
            student_id: r.student_id,
            status: r.status || "present",
            face_confidence: r.face_confidence,
            marked_by: r.marked_by,
            is_manual_override: false,
          })),
          { onConflict: "class_id,student_id" }
        );

      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ success: true, inserted: records.length });
    }

    // ─── POST /students (register student) ───
    if (method === "POST" && path === "/students") {
      const body = await req.json();
      const { roll_number, full_name, email, section_id } = body;

      if (!roll_number || !full_name || !section_id) {
        return jsonResponse({ error: "roll_number, full_name, and section_id are required" }, 400);
      }

      // Check if student already exists
      const { data: existing } = await supabase
        .from("students")
        .select("id")
        .eq("roll_number", roll_number)
        .maybeSingle();

      if (existing) {
        return jsonResponse({ success: true, student_id: existing.id, existing: true });
      }

      const { data, error } = await supabase
        .from("students")
        .insert({ roll_number, full_name, email, section_id })
        .select("id")
        .single();

      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ success: true, student_id: data.id, existing: false });
    }

    return jsonResponse({ error: `Unknown route: ${method} ${path}` }, 404);
  } catch (err) {
    return jsonResponse({ error: err.message }, 401);
  }
});
