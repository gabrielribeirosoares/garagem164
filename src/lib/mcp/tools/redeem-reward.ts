import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "redeem_reward",
  title: "Redeem a reward",
  description: "Redeem a reward by its ID. Points are automatically deducted server-side and the redemption is created in pending status for store admin approval.",
  inputSchema: {
    reward_id: z.string().uuid().describe("UUID of the reward to redeem. Get it from list_rewards."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ reward_id }, ctx) => {
    const denied = requireAuth(ctx);
    if (denied) return denied;
    const sb = supabaseForUser(ctx);
    const { data: reward, error: rErr } = await sb
      .from("rewards")
      .select("id, store_id, cost, title, category, active")
      .eq("id", reward_id)
      .maybeSingle();
    if (rErr) return { content: [{ type: "text", text: rErr.message }], isError: true };
    if (!reward || !reward.active) return { content: [{ type: "text", text: "Reward not found or inactive" }], isError: true };
    const { data, error } = await sb
      .from("redemptions")
      .insert({
        user_id: ctx.getUserId()!,
        reward_id: reward.id,
        store_id: reward.store_id,
        cost: reward.cost,
        reward_title: reward.title,
        reward_category: reward.category,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Redemption created (pending). ID: ${data.id}` }],
      structuredContent: { redemption: data },
    };
  },
});