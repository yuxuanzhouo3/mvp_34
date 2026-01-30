const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkQuota() {
  // 查询所有 Free 用户的配额
  const { data, error } = await supabase
    .from('user_wallets')
    .select('user_id, plan, daily_builds_limit, daily_builds_used')
    .eq('plan', 'Free');

  if (error) {
    console.error('查询失败:', error);
    return;
  }

  console.log('Free 用户配额统计:');
  console.log('总数:', data.length);
  console.log('\n详细信息:');
  data.forEach((user, index) => {
    console.log(`${index + 1}. 用户ID: ${user.user_id}`);
    console.log(`   配额: ${user.daily_builds_used}/${user.daily_builds_limit}`);
    console.log('');
  });

  // 统计不同配额的用户数
  const quotaStats = {};
  data.forEach(user => {
    const limit = user.daily_builds_limit;
    quotaStats[limit] = (quotaStats[limit] || 0) + 1;
  });

  console.log('配额分布:');
  Object.entries(quotaStats).forEach(([limit, count]) => {
    console.log(`  ${limit}次/天: ${count} 个用户`);
  });
}

checkQuota();
