import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyGarage from "./tools/list-my-garage";
import listMyPoints from "./tools/list-my-points";
import listRewards from "./tools/list-rewards";
import redeemReward from "./tools/redeem-reward";
import listMyRedemptions from "./tools/list-my-redemptions";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "minishub-mcp",
  title: "MinisHub",
  version: "0.1.0",
  instructions:
    "Tools for a MinisHub customer's Hot Wheels loyalty account. Use list_my_garage to see cars, list_my_points for point balances per store, list_rewards to browse rewards (filter by store_slug), redeem_reward to spend points, and list_my_redemptions for redemption history.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyGarage, listMyPoints, listRewards, redeemReward, listMyRedemptions],
});