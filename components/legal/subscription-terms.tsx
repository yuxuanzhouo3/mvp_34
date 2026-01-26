"use client";

import { IS_DOMESTIC_VERSION } from "@/config";

interface SubscriptionTermsProps {
  currentLanguage: string;
}

export function SubscriptionTerms({ currentLanguage }: SubscriptionTermsProps) {
  const isZh = currentLanguage === "zh";
  const isDomestic = IS_DOMESTIC_VERSION;

  // 根据版本和语言选择内容
  const content = isDomestic
    ? (isZh ? TERMS_CN_DOMESTIC : TERMS_EN_DOMESTIC)
    : (isZh ? TERMS_CN_INTERNATIONAL : TERMS_EN_INTERNATIONAL);

  return (
    <div className="subscription-terms-content max-w-none px-1 sm:px-2 lg:px-4">
      <style dangerouslySetInnerHTML={{__html: `
        .subscription-terms-content h1 {
          font-size: 1rem;
          font-weight: 700;
          color: rgb(17 24 39);
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid rgb(16 185 129);
        }
        .dark .subscription-terms-content h1 {
          color: rgb(255 255 255);
        }
        @media (min-width: 640px) {
          .subscription-terms-content h1 {
            font-size: 1.125rem;
            margin-bottom: 1.25rem;
          }
        }
        @media (min-width: 1024px) {
          .subscription-terms-content h1 {
            font-size: 1.25rem;
            margin-bottom: 1.5rem;
          }
        }
        .subscription-terms-content h2 {
          font-size: 0.875rem;
          font-weight: 700;
          color: rgb(31 41 55);
          margin-top: 1.25rem;
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
        }
        .dark .subscription-terms-content h2 {
          color: rgb(243 244 246);
        }
        @media (min-width: 640px) {
          .subscription-terms-content h2 {
            font-size: 1rem;
            margin-top: 1.5rem;
            margin-bottom: 1rem;
          }
        }
        @media (min-width: 1024px) {
          .subscription-terms-content h2 {
            font-size: 1.125rem;
            margin-top: 1.75rem;
          }
        }
        .subscription-terms-content h2::before {
          content: '';
          width: 0.25rem;
          height: 1.25rem;
          background: linear-gradient(to bottom, rgb(16 185 129), rgb(20 184 166));
          border-radius: 9999px;
          margin-right: 0.5rem;
        }
        @media (min-width: 640px) {
          .subscription-terms-content h2::before {
            width: 0.375rem;
            margin-right: 0.625rem;
          }
        }
        .subscription-terms-content h3 {
          font-size: 0.75rem;
          font-weight: 600;
          color: rgb(31 41 55);
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .dark .subscription-terms-content h3 {
          color: rgb(229 231 235);
        }
        @media (min-width: 640px) {
          .subscription-terms-content h3 {
            font-size: 0.875rem;
            margin-top: 1.25rem;
            margin-bottom: 0.625rem;
          }
        }
        @media (min-width: 1024px) {
          .subscription-terms-content h3 {
            font-size: 1rem;
          }
        }
        .subscription-terms-content p {
          color: rgb(75 85 99);
          font-size: 0.75rem;
          line-height: 1.625;
          margin-bottom: 0.75rem;
        }
        .dark .subscription-terms-content p {
          color: rgb(209 213 219);
        }
        @media (min-width: 640px) {
          .subscription-terms-content p {
            font-size: 0.875rem;
            margin-bottom: 1rem;
          }
        }
        @media (min-width: 1024px) {
          .subscription-terms-content p {
            font-size: 1rem;
          }
        }
        .subscription-terms-content ul {
          list-style: none;
          margin: 0.75rem 0;
          padding: 0;
        }
        @media (min-width: 640px) {
          .subscription-terms-content ul {
            margin: 1rem 0;
          }
        }
        .subscription-terms-content ol {
          list-style: decimal;
          list-style-position: inside;
          margin: 0.75rem 0;
          padding: 0;
          color: rgb(75 85 99);
          font-size: 0.75rem;
        }
        .dark .subscription-terms-content ol {
          color: rgb(209 213 219);
        }
        @media (min-width: 640px) {
          .subscription-terms-content ol {
            margin: 1rem 0;
            font-size: 0.875rem;
          }
        }
        @media (min-width: 1024px) {
          .subscription-terms-content ol {
            font-size: 1rem;
          }
        }
        .subscription-terms-content li {
          color: rgb(75 85 99);
          font-size: 0.75rem;
          display: flex;
          align-items: start;
          margin-bottom: 0.5rem;
        }
        .dark .subscription-terms-content li {
          color: rgb(209 213 219);
        }
        @media (min-width: 640px) {
          .subscription-terms-content li {
            font-size: 0.875rem;
            margin-bottom: 0.625rem;
          }
        }
        @media (min-width: 1024px) {
          .subscription-terms-content li {
            font-size: 1rem;
          }
        }
        .subscription-terms-content ul li::before {
          content: '';
          width: 0.375rem;
          height: 0.375rem;
          background: rgb(16 185 129);
          border-radius: 9999px;
          margin-right: 0.5rem;
          margin-top: 0.5rem;
          flex-shrink: 0;
        }
        @media (min-width: 640px) {
          .subscription-terms-content ul li::before {
            width: 0.5rem;
            height: 0.5rem;
            margin-right: 0.625rem;
          }
        }
        .subscription-terms-content blockquote {
          border-left: 2px solid rgb(16 185 129);
          background: rgb(236 253 245);
          padding: 0.5rem 0.75rem;
          margin: 1rem 0;
          border-radius: 0 0.5rem 0.5rem 0;
        }
        .dark .subscription-terms-content blockquote {
          background: rgba(16 185 129 / 0.2);
        }
        @media (min-width: 640px) {
          .subscription-terms-content blockquote {
            border-left-width: 4px;
            padding: 0.625rem 1rem;
            margin: 1.25rem 0;
          }
        }
        .subscription-terms-content blockquote p {
          color: rgb(6 95 70);
          font-size: 0.75rem;
        }
        .dark .subscription-terms-content blockquote p {
          color: rgb(167 243 208);
        }
        @media (min-width: 640px) {
          .subscription-terms-content blockquote p {
            font-size: 0.875rem;
          }
        }
        .subscription-terms-content table {
          width: 100%;
          font-size: 0.625rem;
          margin: 1rem 0;
          border-radius: 0.5rem;
          border: 1px solid rgb(229 231 235);
          overflow: hidden;
        }
        .dark .subscription-terms-content table {
          border-color: rgb(55 65 81);
        }
        @media (min-width: 640px) {
          .subscription-terms-content table {
            font-size: 0.75rem;
            margin: 1.25rem 0;
          }
        }
        @media (min-width: 1024px) {
          .subscription-terms-content table {
            font-size: 0.875rem;
          }
        }
        .subscription-terms-content thead {
          background: linear-gradient(to right, rgb(236 253 245), rgb(204 251 241));
        }
        .dark .subscription-terms-content thead {
          background: linear-gradient(to right, rgba(16 185 129 / 0.3), rgba(20 184 166 / 0.3));
        }
        .subscription-terms-content th {
          padding: 0.375rem 0.5rem;
          text-align: left;
          font-size: 0.5625rem;
          font-weight: 600;
          color: rgb(55 65 81);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .dark .subscription-terms-content th {
          color: rgb(229 231 235);
        }
        @media (min-width: 640px) {
          .subscription-terms-content th {
            padding: 0.5rem 0.625rem;
            font-size: 0.625rem;
          }
        }
        @media (min-width: 1024px) {
          .subscription-terms-content th {
            padding: 0.625rem 0.875rem;
            font-size: 0.75rem;
          }
        }
        .subscription-terms-content td {
          padding: 0.375rem 0.5rem;
          font-size: 0.625rem;
          color: rgb(75 85 99);
          border-top: 1px solid rgb(243 244 246);
        }
        .dark .subscription-terms-content td {
          color: rgb(209 213 219);
          border-top-color: rgb(55 65 81);
        }
        @media (min-width: 640px) {
          .subscription-terms-content td {
            padding: 0.5rem 0.625rem;
            font-size: 0.75rem;
          }
        }
        @media (min-width: 1024px) {
          .subscription-terms-content td {
            padding: 0.625rem 0.875rem;
            font-size: 0.875rem;
          }
        }
        .subscription-terms-content strong {
          font-weight: 600;
          color: rgb(17 24 39);
        }
        .dark .subscription-terms-content strong {
          color: rgb(255 255 255);
        }
        .subscription-terms-content hr {
          margin: 1.5rem 0;
          border: 0;
          height: 1px;
          background: linear-gradient(to right, transparent, rgb(209 213 219), transparent);
        }
        .dark .subscription-terms-content hr {
          background: linear-gradient(to right, transparent, rgb(75 85 99), transparent);
        }
        @media (min-width: 640px) {
          .subscription-terms-content hr {
            margin: 2rem 0;
          }
        }
        .subscription-terms-content a {
          color: rgb(5 150 105);
          text-decoration: underline;
          font-size: 0.75rem;
          word-break: break-all;
        }
        .dark .subscription-terms-content a {
          color: rgb(52 211 153);
        }
        @media (min-width: 640px) {
          .subscription-terms-content a {
            font-size: 0.875rem;
          }
        }
        .subscription-terms-content pre {
          background: rgb(243 244 246);
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .dark .subscription-terms-content pre {
          background: rgb(31 41 55);
        }
        @media (min-width: 640px) {
          .subscription-terms-content pre {
            padding: 1rem 1.25rem;
            margin: 1.25rem 0;
          }
        }
        .subscription-terms-content code {
          font-family: ui-monospace, monospace;
          font-size: 0.75rem;
          color: rgb(55 65 81);
        }
        .dark .subscription-terms-content code {
          color: rgb(229 231 235);
        }
        @media (min-width: 640px) {
          .subscription-terms-content code {
            font-size: 0.875rem;
          }
        }
      `}} />
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}

// 国内版中文订阅规则
const TERMS_CN_DOMESTIC = `
<h1>订阅规则（国内版）</h1>
<p><strong>适用版本</strong>：应用构建平台 国内版</p>
<p><strong>生效日期</strong>：2026年1月24日</p>
<p><strong>更新日期</strong>：2026年1月24日</p>
<hr />
<h2>一、订阅套餐</h2>
<table>
<thead>
<tr>
<th style="text-align:center">套餐</th>
<th style="text-align:center">月付价格</th>
<th style="text-align:center">年付价格(月均)</th>
<th style="text-align:center">每日构建次数</th>
<th style="text-align:center">文件保留期限</th>
<th style="text-align:center">批量构建</th>
<th style="text-align:center">分享链接有效期</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">基础版</td>
<td style="text-align:center">免费</td>
<td style="text-align:center">-</td>
<td style="text-align:center">5次</td>
<td style="text-align:center">3天</td>
<td style="text-align:center">❌</td>
<td style="text-align:center">❌</td>
</tr>
<tr>
<td style="text-align:center">专业版</td>
<td style="text-align:center">￥29.90</td>
<td style="text-align:center">￥20.90</td>
<td style="text-align:center">50次</td>
<td style="text-align:center">14天</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">7天</td>
</tr>
<tr>
<td style="text-align:center">团队版</td>
<td style="text-align:center">￥99.90</td>
<td style="text-align:center">￥69.90</td>
<td style="text-align:center">500次</td>
<td style="text-align:center">90天</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">30天</td>
</tr>
</tbody>
</table>
<blockquote><p>**说明**：<br>- **每日构建次数**：每日北京时间 00:00 自动重置<br>- **文件保留期限**：构建文件超过保留期限后将自动删除<br>- **批量构建**：支持一次性构建多个平台的应用<br>- **分享链接**：生成可分享的下载链接，供他人下载您的应用</p></blockquote>
<hr />
<h2>二、订阅计算规则</h2>
<h3>2.1 同级续费（续订相同套餐）</h3>
<p>当您续订相同套餐时，系统会自动顺延有效期：</p>
<ul>
<li><strong>月付续费</strong>：在当前到期日基础上延长 1 个自然月</li>
<li><strong>年付续费</strong>：在当前到期日基础上延长 12 个自然月</li>
<li><strong>月末粘性规则</strong>：如果您的订阅日是 31 号，系统会智能处理大小月问题</li>
</ul>
<p>  - 例如：1月31日续费月付 → 到期日为2月28日（或29日）</p>
<p>  - 3月续费时 → 到期日会自动回调至3月31日</p>
<p>  - 我们承诺不会因大小月差异导致您的订阅日永久提前</p>
<h3>2.2 升级订阅（从低级升至高级）</h3>
<p>当您从较低套餐升级到较高套餐时：</p>
<p>1. <strong>计算剩余价值</strong>：系统会计算您当前套餐的剩余天数，并按日折算剩余价值</p>
<p>   - 剩余价值 = 剩余天数 × (当前套餐月费 ÷ 30)</p>
<p>2. <strong>价值折算</strong>：剩余价值会自动折算为新套餐的使用天数</p>
<p>   - 折算天数 = 剩余价值 ÷ (新套餐月费 ÷ 30)</p>
<p>3. <strong>新到期日计算</strong>：新套餐到期日 = 今天 + 折算天数 + 新购买周期天数</p>
<p>4. <strong>生效时间</strong>：升级立即生效</p>
<p>5. <strong>配额处理</strong>：</p>
<p>   - 升级后立即获得新套餐的每日构建次数上限</p>
<p>   - 文件保留期限立即延长至新套餐标准</p>
<p>   - 已有的构建文件保留期限自动延长</p>
<p><strong>升级示例</strong>：</p>
<pre><code>
当前套餐：专业版（￥29.90/月），剩余 15 天
升级至：团队版（￥99.90/月），购买 1 个月

计算过程：
1. 剩余价值 = 15 × (29.90 ÷ 30) = ￥14.95
2. 折算天数 = 14.95 ÷ (99.90 ÷ 30) = 4.49 天 ≈ 4 天
3. 新到期日 = 今天 + 4 天 + 30 天 = 34 天后
</code></pre>
<h3>2.3 降级订阅（从高级降至低级）</h3>
<p>当您从较高套餐降级到较低套餐时：</p>
<p>1. <strong>延迟生效</strong>：降级不会立即生效，而是在当前套餐到期后次日生效</p>
<p>2. <strong>继续享受</strong>：在当前套餐到期前，您仍可继续享受高级套餐的全部权益</p>
<p>3. <strong>配额调整</strong>：降级生效时，每日构建次数将调整为新套餐的限额</p>
<p>4. <strong>文件处理</strong>：</p>
<p>   - 降级生效时，文件保留期限将调整为新套餐标准</p>
<p>   - 超过新套餐保留期限的文件将在降级生效后逐步清理</p>
<p>5. <strong>待降级状态</strong>：系统会记录您的降级意向，到期后自动执行</p>
<hr />
<h2>三、配额刷新机制</h2>
<h3>3.1 每日构建次数</h3>
<ul>
<li><strong>刷新时间</strong>：每日北京时间 00:00 自动刷新</li>
<li><strong>刷新规则</strong>：每日已用次数重置为 0</li>
<li><strong>配额上限</strong>：</li>
</ul>
<p>  - 基础版：5 次/天</p>
<p>  - 专业版：50 次/天</p>
<p>  - 团队版：500 次/天</p>
<h3>3.2 文件保留期限</h3>
<ul>
<li><strong>计算方式</strong>：从构建完成时间开始计算</li>
<li><strong>自动清理</strong>：超过保留期限的文件将自动删除</li>
<li><strong>保留期限</strong>：</li>
</ul>
<p>  - 基础版：3 天</p>
<p>  - 专业版：14 天</p>
<p>  - 团队版：90 天</p>
<h3>3.3 分享链接有效期</h3>
<ul>
<li><strong>计算方式</strong>：从分享链接创建时间开始计算</li>
<li><strong>自动失效</strong>：超过有效期的分享链接将自动失效</li>
<li><strong>有效期限</strong>：</li>
</ul>
<p>  - 基础版：不支持分享功能</p>
<p>  - 专业版：7 天</p>
<p>  - 团队版：30 天</p>
<hr />
<h2>四、功能权益对比</h2>
<h3>4.1 构建功能</h3>
<table>
<thead>
<tr>
<th style="text-align:center">功能</th>
<th style="text-align:center">基础版</th>
<th style="text-align:center">专业版</th>
<th style="text-align:center">团队版</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">单平台构建</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
<tr>
<td style="text-align:center">批量构建</td>
<td style="text-align:center">❌</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
<tr>
<td style="text-align:center">自定义图标</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
<tr>
<td style="text-align:center">自定义配置</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
</tbody>
</table>
<h3>4.2 文件管理</h3>
<table>
<thead>
<tr>
<th style="text-align:center">功能</th>
<th style="text-align:center">基础版</th>
<th style="text-align:center">专业版</th>
<th style="text-align:center">团队版</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">构建历史查看</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
<tr>
<td style="text-align:center">文件下载</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
<tr>
<td style="text-align:center">分享链接</td>
<td style="text-align:center">❌</td>
<td style="text-align:center">✅（7天）</td>
<td style="text-align:center">✅（30天）</td>
</tr>
<tr>
<td style="text-align:center">构建记录导出</td>
<td style="text-align:center">❌</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
</tbody>
</table>
<h3>4.3 其他权益</h3>
<table>
<thead>
<tr>
<th style="text-align:center">功能</th>
<th style="text-align:center">基础版</th>
<th style="text-align:center">专业版</th>
<th style="text-align:center">团队版</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">广告展示</td>
<td style="text-align:center">有广告</td>
<td style="text-align:center">可隐藏</td>
<td style="text-align:center">可隐藏</td>
</tr>
<tr>
<td style="text-align:center">技术支持</td>
<td style="text-align:center">社区支持</td>
<td style="text-align:center">邮件支持</td>
<td style="text-align:center">优先支持</td>
</tr>
<tr>
<td style="text-align:center">API 访问</td>
<td style="text-align:center">❌</td>
<td style="text-align:center">❌</td>
<td style="text-align:center">✅</td>
</tr>
</tbody>
</table>
<hr />
<h2>五、支付方式</h2>
<h3>5.1 支付宝</h3>
<ul>
<li>支持即时到账</li>
<li>支持月付和年付</li>
<li>自动续费功能（可选）</li>
</ul>
<h3>5.2 微信支付</h3>
<ul>
<li>支持扫码支付</li>
<li>支持月付和年付</li>
<li>自动续费功能（可选）</li>
</ul>
<h3>5.3 自动续费</h3>
<ul>
<li><strong>开启方式</strong>：在订阅页面勾选"自动续费"选项</li>
<li><strong>扣款时间</strong>：在订阅到期前 1 天自动扣款</li>
<li><strong>扣款失败</strong>：如果扣款失败，系统会在到期后 3 天内每天重试一次</li>
<li><strong>关闭方式</strong>：在设置中随时关闭自动续费</li>
<li><strong>关闭生效</strong>：关闭后，当前订阅周期结束后不再自动续费</li>
</ul>
<hr />
<h2>六、变更与续费</h2>
<h3>6.1 升级套餐 (Upgrade)</h3>
<ul>
<li>升级立即生效</li>
<li>剩余价值自动折算为新套餐使用天数</li>
<li>立即获得新套餐的完整权益</li>
<li>文件保留期限立即延长</li>
</ul>
<h3>6.2 续费 (Renewal)</h3>
<ul>
<li>续费成功后，订阅日保持不变</li>
<li>有效期在当前到期日基础上顺延</li>
<li>每日构建次数继续按套餐标准刷新</li>
</ul>
<h3>6.3 降级 (Downgrade)</h3>
<ul>
<li>降级在当前套餐到期后次日生效</li>
<li>到期前继续享受当前套餐权益</li>
<li>降级生效时，配额调整为新套餐标准</li>
</ul>
<h3>6.4 过期/取消 (Expiration)</h3>
<ul>
<li>订阅过期后，自动降级为基础版</li>
<li>超过基础版保留期限的文件将被逐步清理</li>
<li>分享链接立即失效</li>
</ul>
<hr />
<h2>七、特殊说明</h2>
<h3>7.1 构建次数计算</h3>
<ul>
<li><strong>成功构建</strong>：计入每日构建次数</li>
<li><strong>失败构建</strong>：不计入每日构建次数</li>
<li><strong>取消构建</strong>：不计入每日构建次数</li>
<li><strong>批量构建</strong>：每个平台分别计算一次</li>
</ul>
<h3>7.2 文件存储</h3>
<ul>
<li>所有构建文件存储在云端服务器</li>
<li>文件大小不限制（单个文件最大 2GB）</li>
<li>超过保留期限的文件将自动删除且无法恢复</li>
<li>建议及时下载重要文件到本地</li>
</ul>
<h3>7.3 分享链接规则</h3>
<ul>
<li>每个构建可以生成一个分享链接</li>
<li>分享链接可以设置访问密码（可选）</li>
<li>分享链接可以随时手动失效</li>
<li>通过分享链接下载不消耗您的构建次数</li>
</ul>
<hr />
<h2>八、异常与限制</h2>
<h3>8.1 扣款失败</h3>
<p>若自动续费失败，系统将：</p>
<p>1. 在到期后 3 天内每天重试一次</p>
<p>2. 如果 3 天内仍未成功，订阅将自动过期</p>
<p>3. 过期后自动降级为基础版</p>
<p>4. 您可以随时手动续费恢复订阅</p>
<h3>8.2 滥用检测</h3>
<p>系统会监控异常使用行为，包括但不限于：</p>
<ul>
<li>短时间内大量构建请求</li>
<li>恶意构建违规应用</li>
<li>滥用分享链接功能</li>
<li>其他违反服务条款的行为</li>
</ul>
<p><strong>处理措施</strong>：</p>
<ul>
<li>首次警告：系统通知</li>
<li>二次违规：暂停服务 24 小时</li>
<li>三次违规：永久封禁账户</li>
</ul>
<h3>8.3 服务限制</h3>
<ul>
<li>单次批量构建最多支持 9 个平台</li>
<li>单个应用图标最大 10MB</li>
<li>构建队列最多排队 100 个任务</li>
<li>API 调用频率限制（团队版专属）</li>
</ul>
<hr />
<h2>九、退款政策</h2>
<h3>9.1 订阅退款</h3>
<ul>
<li><strong>7天无理由退款</strong>：首次订阅后 7 天内，如未使用任何构建次数，可申请全额退款</li>
<li><strong>部分退款</strong>：订阅后 7 天内，已使用部分构建次数，可按比例退款</li>
<li><strong>不支持退款</strong>：订阅超过 7 天后，不支持退款</li>
<li><strong>删除账户</strong>：删除账户时，剩余订阅时长将被作废，不予退款</li>
</ul>
<h3>9.2 退款流程</h3>
<p>1. 联系客服申请退款</p>
<p>2. 提供订单号和退款原因</p>
<p>3. 客服审核（1-3 个工作日）</p>
<p>4. 审核通过后，退款原路返回（3-7 个工作日）</p>
<hr />
<h2>十、联系我们</h2>
<p>如果您对订阅规则有任何疑问，请通过以下方式联系我们：</p>
<ul>
<li><strong>邮箱</strong>：mornscience@gmail.com</li>
<li><strong>服务时间</strong>：周一至周五 9:00-18:00（北京时间）</li>
<li><strong>在线客服</strong>：工作日 9:00-18:00</li>
</ul>
<hr />
<p><strong>© 2026 MornClient. All rights reserved.</strong></p>
`;

// 国内版英文订阅规则
const TERMS_EN_DOMESTIC = `
<h2>Subscription Terms (Domestic Edition)</h2>
<p><strong>Effective Date:</strong> January 24, 2026</p>
<p>Please refer to the Chinese version for complete terms.</p>
`;

// 国际版中文订阅规则
const TERMS_CN_INTERNATIONAL = `
<h2>订阅规则（国际版）</h2>
<p><strong>生效日期：</strong>2026年1月24日</p>
<p>请参阅英文版本以获取完整条款。</p>
`;

// 国际版英文订阅规则
const TERMS_EN_INTERNATIONAL = `
<h1>Subscription Terms (Global Edition)</h1>
<p><strong>Applicable Edition</strong>: App Builder Platform Global Edition</p>
<p><strong>Effective Date</strong>: January 24, 2026</p>
<p><strong>Last Updated</strong>: January 24, 2026</p>
<hr />
<h2>1. Subscription Plans</h2>
<table>
<thead>
<tr>
<th style="text-align:center">Plan</th>
<th style="text-align:center">Monthly Price</th>
<th style="text-align:center">Annual Price (per month)</th>
<th style="text-align:center">Daily Build Limit</th>
<th style="text-align:center">File Retention</th>
<th style="text-align:center">Batch Build</th>
<th style="text-align:center">Share Link Validity</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">Free</td>
<td style="text-align:center">Free</td>
<td style="text-align:center">-</td>
<td style="text-align:center">5 builds</td>
<td style="text-align:center">3 days</td>
<td style="text-align:center">❌</td>
<td style="text-align:center">❌</td>
</tr>
<tr>
<td style="text-align:center">Pro</td>
<td style="text-align:center">$9.99</td>
<td style="text-align:center">$6.99</td>
<td style="text-align:center">50 builds</td>
<td style="text-align:center">14 days</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">7 days</td>
</tr>
<tr>
<td style="text-align:center">Team</td>
<td style="text-align:center">$29.99</td>
<td style="text-align:center">$20.99</td>
<td style="text-align:center">500 builds</td>
<td style="text-align:center">90 days</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">30 days</td>
</tr>
</tbody>
</table>
<blockquote><p>**Notes**:<br>- **Daily Build Limit**: Automatically resets daily at 00:00 UTC<br>- **File Retention**: Build files are automatically deleted after the retention period<br>- **Batch Build**: Build applications for multiple platforms simultaneously<br>- **Share Link**: Generate shareable download links for your applications</p></blockquote>
<hr />
<h2>2. Subscription Calculation Rules</h2>
<h3>2.1 Same-tier Renewal (Extending the same plan)</h3>
<p>When you renew the same subscription plan, the system automatically extends your expiration date:</p>
<ul>
<li><strong>Monthly Renewal</strong>: Extends by 1 calendar month from current expiration date</li>
<li><strong>Annual Renewal</strong>: Extends by 12 calendar months from current expiration date</li>
<li><strong>Month-end Stickiness Rule</strong>: If your subscription date is the 31st, the system handles month differences intelligently</li>
</ul>
<p>  - Example: Jan 31 monthly renewal → expires Feb 28 (or 29)</p>
<p>  - March renewal → expiration auto-adjusts back to Mar 31</p>
<p>  - We guarantee your subscription date won't permanently shift earlier due to month-length differences</p>
<h3>2.2 Upgrading Subscription (Lower to Higher tier)</h3>
<p>When upgrading from a lower-tier to a higher-tier plan:</p>
<p>1. <strong>Calculate Remaining Value</strong>: The system calculates remaining days of your current plan and prorates the value</p>
<p>   - Remaining Value = Remaining Days × (Current Plan Monthly Price ÷ 30)</p>
<p>2. <strong>Value Conversion</strong>: Remaining value is converted to days on the new plan</p>
<p>   - Converted Days = Remaining Value ÷ (New Plan Monthly Price ÷ 30)</p>
<p>3. <strong>New Expiration Calculation</strong>: New plan expires = Today + Converted Days + Purchased Period Days</p>
<p>4. <strong>Effective Time</strong>: Upgrade takes effect immediately</p>
<p>5. <strong>Quota Handling</strong>:</p>
<p>   - You immediately receive the new plan's daily build limit</p>
<p>   - File retention period is immediately extended to the new plan's standard</p>
<p>   - Existing build files have their retention period automatically extended</p>
<p><strong>Upgrade Example</strong>:</p>
<pre><code>
Current Plan: Pro ($9.99/month), 15 days remaining
Upgrade to: Team ($29.99/month), purchase 1 month

Calculation:
1. Remaining Value = 15 × (9.99 ÷ 30) = $4.995
2. Converted Days = 4.995 ÷ (29.99 ÷ 30) = 4.99 days ≈ 5 days
3. New Expiration = Today + 5 days + 30 days = 35 days from now
</code></pre>
<h3>2.3 Downgrading Subscription (Higher to Lower tier)</h3>
<p>When downgrading from a higher-tier to a lower-tier plan:</p>
<p>1. <strong>Delayed Effect</strong>: Downgrade does NOT take effect immediately; it activates the day after your current plan expires</p>
<p>2. <strong>Continue Enjoying</strong>: You continue enjoying all higher-tier benefits until current plan expiration</p>
<p>3. <strong>Quota Adjustment</strong>: When downgrade activates, daily build limit adjusts to the new plan's limit</p>
<p>4. <strong>File Handling</strong>:</p>
<p>   - File retention period adjusts to the new plan's standard when downgrade takes effect</p>
<p>   - Files exceeding the new plan's retention period will be gradually cleaned up after downgrade</p>
<p>5. <strong>Pending Status</strong>: The system records your downgrade intent and auto-executes upon expiration</p>
<hr />
<h2>3. Quota Refresh Mechanism</h2>
<h3>3.1 Daily Build Limit</h3>
<ul>
<li><strong>Refresh Time</strong>: Automatically refreshes daily at 00:00 UTC</li>
<li><strong>Refresh Rule</strong>: Daily used count resets to 0</li>
<li><strong>Quota Limits</strong>:</li>
</ul>
<p>  - Free: 5 builds/day</p>
<p>  - Pro: 50 builds/day</p>
<p>  - Team: 500 builds/day</p>
<h3>3.2 File Retention Period</h3>
<ul>
<li><strong>Calculation Method</strong>: Calculated from build completion time</li>
<li><strong>Automatic Cleanup</strong>: Files exceeding the retention period are automatically deleted</li>
<li><strong>Retention Periods</strong>:</li>
</ul>
<p>  - Free: 3 days</p>
<p>  - Pro: 14 days</p>
<p>  - Team: 90 days</p>
<h3>3.3 Share Link Validity</h3>
<ul>
<li><strong>Calculation Method</strong>: Calculated from share link creation time</li>
<li><strong>Automatic Expiration</strong>: Share links exceeding the validity period automatically expire</li>
<li><strong>Validity Periods</strong>:</li>
</ul>
<p>  - Free: Share feature not supported</p>
<p>  - Pro: 7 days</p>
<p>  - Team: 30 days</p>
<hr />
<h2>4. Feature Benefits Comparison</h2>
<h3>4.1 Build Features</h3>
<table>
<thead>
<tr>
<th style="text-align:center">Feature</th>
<th style="text-align:center">Free</th>
<th style="text-align:center">Pro</th>
<th style="text-align:center">Team</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">Single Platform Build</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
<tr>
<td style="text-align:center">Batch Build</td>
<td style="text-align:center">❌</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
<tr>
<td style="text-align:center">Custom Icon</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
<tr>
<td style="text-align:center">Custom Configuration</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
</tbody>
</table>
<h3>4.2 File Management</h3>
<table>
<thead>
<tr>
<th style="text-align:center">Feature</th>
<th style="text-align:center">Free</th>
<th style="text-align:center">Pro</th>
<th style="text-align:center">Team</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">Build History View</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
<tr>
<td style="text-align:center">File Download</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
<tr>
<td style="text-align:center">Share Links</td>
<td style="text-align:center">❌</td>
<td style="text-align:center">✅ (7 days)</td>
<td style="text-align:center">✅ (30 days)</td>
</tr>
<tr>
<td style="text-align:center">Build Record Export</td>
<td style="text-align:center">❌</td>
<td style="text-align:center">✅</td>
<td style="text-align:center">✅</td>
</tr>
</tbody>
</table>
<h3>4.3 Other Benefits</h3>
<table>
<thead>
<tr>
<th style="text-align:center">Feature</th>
<th style="text-align:center">Free</th>
<th style="text-align:center">Pro</th>
<th style="text-align:center">Team</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">Advertisements</td>
<td style="text-align:center">With Ads</td>
<td style="text-align:center">Can Hide</td>
<td style="text-align:center">Can Hide</td>
</tr>
<tr>
<td style="text-align:center">Technical Support</td>
<td style="text-align:center">Community</td>
<td style="text-align:center">Email</td>
<td style="text-align:center">Priority</td>
</tr>
<tr>
<td style="text-align:center">API Access</td>
<td style="text-align:center">❌</td>
<td style="text-align:center">❌</td>
<td style="text-align:center">✅</td>
</tr>
</tbody>
</table>
<hr />
<h2>5. Payment Methods</h2>
<h3>5.1 Stripe</h3>
<ul>
<li>Instant payment processing</li>
<li>Supports monthly and annual subscriptions</li>
<li>Auto-renewal available (optional)</li>
</ul>
<h3>5.2 PayPal</h3>
<ul>
<li>Secure payment processing</li>
<li>Supports monthly and annual subscriptions</li>
<li>Auto-renewal available (optional)</li>
</ul>
<h3>5.3 Auto-Renewal</h3>
<ul>
<li><strong>Enable</strong>: Check "Auto-renewal" option on subscription page</li>
<li><strong>Charge Time</strong>: Automatic charge 1 day before subscription expires</li>
<li><strong>Charge Failure</strong>: If charge fails, system retries once daily for 3 days after expiration</li>
<li><strong>Disable</strong>: Can be disabled anytime in settings</li>
<li><strong>Effect</strong>: After disabling, no auto-renewal after current subscription period ends</li>
</ul>
<hr />
<h2>6. Changes & Renewal</h2>
<h3>6.1 Upgrade</h3>
<ul>
<li>Upgrade takes effect immediately</li>
<li>Remaining value automatically converts to new plan usage days</li>
<li>Immediately receive full benefits of new plan</li>
<li>File retention period immediately extended</li>
</ul>
<h3>6.2 Renewal</h3>
<ul>
<li>After successful renewal, subscription date remains unchanged</li>
<li>Expiration date extends from current expiration date</li>
<li>Daily build limit continues to refresh according to plan standard</li>
</ul>
<h3>6.3 Downgrade</h3>
<ul>
<li>Downgrade takes effect the day after current plan expires</li>
<li>Continue enjoying current plan benefits until expiration</li>
<li>When downgrade takes effect, quota adjusts to new plan standard</li>
</ul>
<h3>6.4 Expiration/Cancellation</h3>
<ul>
<li>After subscription expires, automatically downgrade to Free plan</li>
<li>Files exceeding Free plan retention period will be gradually cleaned up</li>
<li>Share links immediately expire</li>
</ul>
<hr />
<h2>7. Special Notes</h2>
<h3>7.1 Build Count Calculation</h3>
<ul>
<li><strong>Successful Build</strong>: Counts toward daily build limit</li>
<li><strong>Failed Build</strong>: Does NOT count toward daily build limit</li>
<li><strong>Cancelled Build</strong>: Does NOT count toward daily build limit</li>
<li><strong>Batch Build</strong>: Each platform counts as one build</li>
</ul>
<h3>7.2 File Storage</h3>
<ul>
<li>All build files are stored on cloud servers</li>
<li>No file size limit (max 2GB per file)</li>
<li>Files exceeding retention period are automatically deleted and cannot be recovered</li>
<li>Recommend downloading important files to local storage promptly</li>
</ul>
<h3>7.3 Share Link Rules</h3>
<ul>
<li>Each build can generate one share link</li>
<li>Share links can be password-protected (optional)</li>
<li>Share links can be manually invalidated anytime</li>
<li>Downloads via share links do NOT consume your build quota</li>
</ul>
<hr />
<h2>8. Exceptions & Limitations</h2>
<h3>8.1 Payment Failure</h3>
<p>If automatic renewal fails, the system will:</p>
<p>1. Retry once daily for 3 days after expiration</p>
<p>2. If still unsuccessful after 3 days, subscription automatically expires</p>
<p>3. After expiration, automatically downgrade to Free plan</p>
<p>4. You can manually renew anytime to restore subscription</p>
<h3>8.2 Abuse Detection</h3>
<p>The system monitors abnormal usage behavior, including but not limited to:</p>
<ul>
<li>Large number of build requests in short time</li>
<li>Malicious building of prohibited applications</li>
<li>Abuse of share link feature</li>
<li>Other violations of Terms of Service</li>
</ul>
<p><strong>Consequences</strong>:</p>
<ul>
<li>First warning: System notification</li>
<li>Second violation: Service suspended for 24 hours</li>
<li>Third violation: Permanent account ban</li>
</ul>
<h3>8.3 Service Limitations</h3>
<ul>
<li>Maximum 9 platforms per batch build</li>
<li>Maximum 10MB per app icon</li>
<li>Maximum 100 tasks in build queue</li>
<li>API rate limiting (Team plan exclusive)</li>
</ul>
<hr />
<h2>9. Refund Policy</h2>
<h3>9.1 Subscription Refunds</h3>
<ul>
<li><strong>7-Day Money-Back Guarantee</strong>: Within 7 days of first subscription, if no builds have been used, full refund available</li>
<li><strong>Partial Refund</strong>: Within 7 days of subscription, if some builds have been used, proportional refund available</li>
<li><strong>No Refund</strong>: After 7 days of subscription, refunds not supported</li>
<li><strong>Account Deletion</strong>: When deleting account, remaining subscription time will be forfeited with no refund</li>
</ul>
<h3>9.2 Refund Process</h3>
<p>1. Contact customer service to request refund</p>
<p>2. Provide order number and refund reason</p>
<p>3. Customer service review (1-3 business days)</p>
<p>4. After approval, refund returns via original payment method (3-7 business days)</p>
<hr />
<h2>10. Contact Us</h2>
<p>If you have any questions about these Subscription Terms, please contact us:</p>
<ul>
<li><strong>Email</strong>: mornscience@gmail.com</li>
<li><strong>Business Hours</strong>: Monday to Friday, 9:00 AM - 6:00 PM (UTC)</li>
<li><strong>Live Chat</strong>: Weekdays 9:00 AM - 6:00 PM</li>
</ul>
<hr />
<p><strong>© 2026 MornClient. All rights reserved.</strong></p>
`;
