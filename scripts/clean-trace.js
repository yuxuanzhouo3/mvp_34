const fs = require('fs');
const path = require('path');

const nextDir = path.join(__dirname, '..', '.next');
const traceFile = path.join(nextDir, 'trace');

try {
  // 尝试删除 trace 文件
  if (fs.existsSync(traceFile)) {
    fs.rmSync(traceFile, { force: true, maxRetries: 3, retryDelay: 100 });
  }
} catch (e) {
  // 如果删除失败，删除整个 .next 目录
  try {
    fs.rmSync(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    console.log('Cleaned .next directory due to locked trace file');
  } catch (e2) {
    // 忽略错误，让 Next.js 自己处理
  }
}
