import { SupabaseClient } from "npm:@supabase/supabase-js@2.50.0";

export async function reserveQuota(
  user_id: string,
  quota_type: "cloud-run-minutes",
  amount_used: number,
  taskStore: SupabaseClient,
  explanation: Record<string, unknown>
): Promise<string | null> {
  // Get the user's quota limit
  const { data: quota, error: quotaError } = await taskStore
    .from("quotas")
    .select("*")
    .eq("user_id", user_id)
    .eq("quota_type", quota_type)
    .single();

  if (!quota) {
    return `Can't find quota for user ${user_id} and quota type ${quota_type}`;
  }
  if (quotaError) {
    return `Failed to check quota: ${quotaError.message}`;
  }

  // Get current month's usage with SQL aggregation
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const { data: usageResult, error: usageError } = await taskStore
    .from("quota_usage")
    .select("amount_used.sum()")
    .eq("quota_id", quota.id)
    .gte("usage_ts", startOfMonth.toISOString())
    .lte("usage_ts", endOfMonth.toISOString())
    .single();

  if (usageError || !usageResult) {
    return `Failed to check quota usage: ${usageError?.message}`;
  }
  console.log(
    `For user ${user_id} and quota ${quota_type} usageResult: ${JSON.stringify(
      usageResult
    )}`
  );

  // Extract the sum from the result
  const totalUsage = usageResult.sum ?? 0;
  const projectedUsage = totalUsage + amount_used;

  console.log(
    `For user ${user_id} and quota ${quota_type} projectedUsage: ${projectedUsage} quota.monthly_limit: ${quota.monthly_limit}`
  );

  // Check if projected usage exceeds quota
  if (projectedUsage >= quota.monthly_limit) {
    return `Quota ${quota_type} exceeded. Current usage: ${totalUsage}, Requested: ${amount_used}, Limit: ${quota.monthly_limit}`;
  }

  const { error: insertError } = await taskStore.from("quota_usage").insert({
    quota_id: quota.id,
    amount_used: amount_used,
    usage_ts: new Date().toISOString(),
    explanation: explanation
  });

  if (insertError) {
    return `Failed to insert quota usage: ${insertError.message}`;
  }

  return null; // Quota check passed
}
