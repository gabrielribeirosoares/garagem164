import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_garage",
  title: "List my garage",
  description: "List all Hot Wheels cars in the signed-in user's garage across every store, with points earned per car.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("cars")
      .select("id, name, points, image_url, store_id, payment_status, shipping_status, created_at, stores(name, slug)")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { cars: data ?? [] },
    };
  },
});

// re-export z so the tsc doesn't complain about unused import
export const _z = z;