import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return new Response(JSON.stringify({ service_role_key: key ? key.slice(0, 20) + "..." + key.slice(-20) : "NOT FOUND", full_key: key }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
