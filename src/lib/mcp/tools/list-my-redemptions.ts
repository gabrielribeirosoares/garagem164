import { defineTool } from "@lovable.dev/mcp-js";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_redemptions",
  title: "List my redemptions",
  description: "List the signed-in user's reward redemption history, including status (pending, completed, cancelled).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("redemptions")
      .select("id, reward_title, reward_category, cost, status, created_at, store_id, stores(name, slug)")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { redemptions: data ?? [] },
    };
  },
});