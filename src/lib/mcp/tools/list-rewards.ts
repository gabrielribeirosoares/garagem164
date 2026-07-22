import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_rewards",
  title: "List available rewards",
  description: "List active rewards. Optionally filter by store slug to see rewards from a specific store.",
  inputSchema: {
    store_slug: z.string().optional().describe("Filter by store slug. Omit to list rewards from every store."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ store_slug }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("rewards")
      .select("id, title, category, cost, image_url, active, store_id, stores!inner(name, slug)")
      .eq("active", true)
      .order("cost", { ascending: true });
    if (store_slug) q = q.eq("stores.slug", store_slug);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { rewards: data ?? [] },
    };
  },
});