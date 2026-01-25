"use client";

import { IS_DOMESTIC_VERSION } from "@/config";

interface PrivacyPolicyProps {
  currentLanguage: string;
}

export function PrivacyPolicy({ currentLanguage }: PrivacyPolicyProps) {
  const isZh = currentLanguage === "zh";
  const isDomestic = IS_DOMESTIC_VERSION;

  // 根据版本和语言选择内容
  const content = isDomestic
    ? (isZh ? PRIVACY_CN_DOMESTIC : PRIVACY_EN_DOMESTIC)
    : (isZh ? PRIVACY_CN_INTERNATIONAL : PRIVACY_EN_INTERNATIONAL);

  return (
    <div className="privacy-policy-content max-w-none px-1 sm:px-2 lg:px-4">
      <style dangerouslySetInnerHTML={{__html: `
        .privacy-policy-content h1 {
          font-size: 1rem;
          font-weight: 700;
          color: rgb(17 24 39);
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid rgb(59 130 246);
        }
        .dark .privacy-policy-content h1 {
          color: rgb(255 255 255);
        }
        @media (min-width: 640px) {
          .privacy-policy-content h1 {
            font-size: 1.125rem;
            margin-bottom: 1.25rem;
          }
        }
        @media (min-width: 1024px) {
          .privacy-policy-content h1 {
            font-size: 1.25rem;
            margin-bottom: 1.5rem;
          }
        }
        .privacy-policy-content h2 {
          font-size: 0.875rem;
          font-weight: 700;
          color: rgb(31 41 55);
          margin-top: 1.25rem;
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
        }
        .dark .privacy-policy-content h2 {
          color: rgb(243 244 246);
        }
        @media (min-width: 640px) {
          .privacy-policy-content h2 {
            font-size: 1rem;
            margin-top: 1.5rem;
            margin-bottom: 1rem;
          }
        }
        @media (min-width: 1024px) {
          .privacy-policy-content h2 {
            font-size: 1.125rem;
            margin-top: 1.75rem;
          }
        }
        .privacy-policy-content h2::before {
          content: '';
          width: 0.25rem;
          height: 1.25rem;
          background: linear-gradient(to bottom, rgb(59 130 246), rgb(168 85 247));
          border-radius: 9999px;
          margin-right: 0.5rem;
        }
        @media (min-width: 640px) {
          .privacy-policy-content h2::before {
            width: 0.375rem;
            margin-right: 0.625rem;
          }
        }
        .privacy-policy-content h3 {
          font-size: 0.75rem;
          font-weight: 600;
          color: rgb(31 41 55);
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .dark .privacy-policy-content h3 {
          color: rgb(229 231 235);
        }
        @media (min-width: 640px) {
          .privacy-policy-content h3 {
            font-size: 0.875rem;
            margin-top: 1.25rem;
            margin-bottom: 0.625rem;
          }
        }
        @media (min-width: 1024px) {
          .privacy-policy-content h3 {
            font-size: 1rem;
          }
        }
        .privacy-policy-content p {
          color: rgb(75 85 99);
          font-size: 0.75rem;
          line-height: 1.625;
          margin-bottom: 0.75rem;
        }
        .dark .privacy-policy-content p {
          color: rgb(209 213 219);
        }
        @media (min-width: 640px) {
          .privacy-policy-content p {
            font-size: 0.875rem;
            margin-bottom: 1rem;
          }
        }
        @media (min-width: 1024px) {
          .privacy-policy-content p {
            font-size: 1rem;
          }
        }
        .privacy-policy-content ul {
          list-style: none;
          margin: 0.75rem 0;
          padding: 0;
        }
        @media (min-width: 640px) {
          .privacy-policy-content ul {
            margin: 1rem 0;
          }
        }
        .privacy-policy-content li {
          color: rgb(75 85 99);
          font-size: 0.75rem;
          display: flex;
          align-items: start;
          margin-bottom: 0.5rem;
        }
        .dark .privacy-policy-content li {
          color: rgb(209 213 219);
        }
        @media (min-width: 640px) {
          .privacy-policy-content li {
            font-size: 0.875rem;
            margin-bottom: 0.625rem;
          }
        }
        @media (min-width: 1024px) {
          .privacy-policy-content li {
            font-size: 1rem;
          }
        }
        .privacy-policy-content li::before {
          content: '';
          width: 0.375rem;
          height: 0.375rem;
          background: rgb(59 130 246);
          border-radius: 9999px;
          margin-right: 0.5rem;
          margin-top: 0.5rem;
          flex-shrink: 0;
        }
        @media (min-width: 640px) {
          .privacy-policy-content li::before {
            width: 0.5rem;
            height: 0.5rem;
            margin-right: 0.625rem;
          }
        }
        .privacy-policy-content blockquote {
          border-left: 2px solid rgb(251 191 36);
          background: rgb(254 252 232);
          padding: 0.5rem 0.75rem;
          margin: 1rem 0;
          border-radius: 0 0.5rem 0.5rem 0;
        }
        .dark .privacy-policy-content blockquote {
          background: rgba(217 119 6 / 0.2);
        }
        @media (min-width: 640px) {
          .privacy-policy-content blockquote {
            border-left-width: 4px;
            padding: 0.625rem 1rem;
            margin: 1.25rem 0;
          }
        }
        .privacy-policy-content blockquote p {
          color: rgb(146 64 14);
          font-size: 0.75rem;
        }
        .dark .privacy-policy-content blockquote p {
          color: rgb(254 215 170);
        }
        @media (min-width: 640px) {
          .privacy-policy-content blockquote p {
            font-size: 0.875rem;
          }
        }
        .privacy-policy-content table {
          width: 100%;
          font-size: 0.625rem;
          margin: 1rem 0;
          border-radius: 0.5rem;
          border: 1px solid rgb(229 231 235);
          overflow: hidden;
        }
        .dark .privacy-policy-content table {
          border-color: rgb(55 65 81);
        }
        @media (min-width: 640px) {
          .privacy-policy-content table {
            font-size: 0.75rem;
            margin: 1.25rem 0;
          }
        }
        @media (min-width: 1024px) {
          .privacy-policy-content table {
            font-size: 0.875rem;
          }
        }
        .privacy-policy-content thead {
          background: linear-gradient(to right, rgb(239 246 255), rgb(243 232 255));
        }
        .dark .privacy-policy-content thead {
          background: linear-gradient(to right, rgba(59 130 246 / 0.3), rgba(168 85 247 / 0.3));
        }
        .privacy-policy-content th {
          padding: 0.375rem 0.5rem;
          text-align: left;
          font-size: 0.5625rem;
          font-weight: 600;
          color: rgb(55 65 81);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .dark .privacy-policy-content th {
          color: rgb(229 231 235);
        }
        @media (min-width: 640px) {
          .privacy-policy-content th {
            padding: 0.5rem 0.625rem;
            font-size: 0.625rem;
          }
        }
        @media (min-width: 1024px) {
          .privacy-policy-content th {
            padding: 0.625rem 0.875rem;
            font-size: 0.75rem;
          }
        }
        .privacy-policy-content td {
          padding: 0.375rem 0.5rem;
          font-size: 0.625rem;
          color: rgb(75 85 99);
          border-top: 1px solid rgb(243 244 246);
        }
        .dark .privacy-policy-content td {
          color: rgb(209 213 219);
          border-top-color: rgb(55 65 81);
        }
        @media (min-width: 640px) {
          .privacy-policy-content td {
            padding: 0.5rem 0.625rem;
            font-size: 0.75rem;
          }
        }
        @media (min-width: 1024px) {
          .privacy-policy-content td {
            padding: 0.625rem 0.875rem;
            font-size: 0.875rem;
          }
        }
        .privacy-policy-content strong {
          font-weight: 600;
          color: rgb(17 24 39);
        }
        .dark .privacy-policy-content strong {
          color: rgb(255 255 255);
        }
        .privacy-policy-content hr {
          margin: 1.5rem 0;
          border: 0;
          height: 1px;
          background: linear-gradient(to right, transparent, rgb(209 213 219), transparent);
        }
        .dark .privacy-policy-content hr {
          background: linear-gradient(to right, transparent, rgb(75 85 99), transparent);
        }
        @media (min-width: 640px) {
          .privacy-policy-content hr {
            margin: 2rem 0;
          }
        }
        .privacy-policy-content a {
          color: rgb(37 99 235);
          text-decoration: underline;
          font-size: 0.75rem;
          word-break: break-all;
        }
        .dark .privacy-policy-content a {
          color: rgb(96 165 250);
        }
        @media (min-width: 640px) {
          .privacy-policy-content a {
            font-size: 0.875rem;
          }
        }
      `}} />
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}

// 国内版中文隐私条款
const PRIVACY_CN_DOMESTIC = `
<h1>隐私条款（国内版）</h1>
<p><strong>适用版本</strong>：应用构建平台 国内版</p>
<p><strong>合规法规</strong>：《中华人民共和国个人信息保护法》(PIPL)、《网络安全法》、《数据安全法》</p>
<p><strong>生效日期</strong>：2026年1月24日</p>
<p><strong>更新日期</strong>：2026年1月24日</p>
<hr />
<p>应用构建平台（以下简称"我们"）非常重视您的隐私。本政策适用于您通过网页端使用我们的应用构建服务。</p>
<hr />
<h2>一、我们如何收集和使用您的信息</h2>
<h3>1.1 账号注册与登录</h3>
<h4>1.1.1 邮箱登录</h4>
<p>当您使用邮箱注册或登录时，我们将收集以下信息：</p>
<ul>
<li><strong>电子邮箱地址</strong>：用于账号注册、登录验证及账户找回</li>
<li><strong>加密密码</strong>：使用 bcrypt 算法（salt rounds: 10）单向加密存储，我们无法获取您的明文密码</li>
</ul>
<h4>1.1.2 微信登录</h4>
<p>当您使用微信扫码登录时，我们将通过微信开放平台收集以下信息：</p>
<ul>
<li><strong>微信 OpenID</strong>：您在本应用中的唯一标识符</li>
<li><strong>微信 UnionID</strong>（如有）：用于同一开放平台账号下的多应用关联</li>
<li><strong>微信昵称</strong>：用于展示您的用户名称</li>
<li><strong>微信头像</strong>：用于展示您的用户头像</li>
</ul>
<blockquote><p><strong>法律依据</strong>：收集上述信息是为了履行与您的合同（提供服务）都符合《个人信息保护法》第十三条第二款的规定。</p></blockquote>
<h3>1.2 核心业务功能</h3>
<h4>1.2.1 应用构建服务</h4>
<p>当您使用我们的应用构建服务时，我们将收集和处理以下信息：</p>
<p><strong>必需信息</strong>：</p>
<ul>
<li><strong>目标网页 URL</strong>：您希望转换为应用的网页地址</li>
<li><strong>应用名称</strong>：您为应用设置的名称</li>
<li><strong>应用图标</strong>（可选）：您上传的应用图标文件（PNG、JPEG、GIF、WebP格式，最大 10MB）</li>
<li><strong>应用描述</strong>（可选）：应用的简短描述</li>
</ul>
<p><strong>平台特定配置</strong>：</p>
<ul>
<li><strong>Android</strong>：包名（Package Name）、版本号、版本代码、隐私政策链接</li>
<li><strong>iOS</strong>：Bundle ID、版本号、构建号、隐私政策链接</li>
<li><strong>HarmonyOS</strong>：Bundle Name、版本号、版本代码、隐私政策链接</li>
<li><strong>Windows/Mac/Linux</strong>：应用名称、应用图标</li>
<li><strong>Chrome 扩展</strong>：扩展名称、版本号、描述、图标</li>
<li><strong>微信小程序</strong>：AppID、版本号</li>
</ul>
<p><strong>数据使用目的</strong>：</p>
<ul>
<li>生成对应平台的应用安装包</li>
<li>保存构建记录供您查看和下载</li>
<li>提供构建历史和管理功能</li>
</ul>
<h4>1.2.2 文件存储与管理</h4>
<ul>
<li><strong>构建文件</strong>：生成的应用安装包存储在云端存储服务（腾讯云 CloudBase / Supabase Storage）</li>
<li><strong>应用图标</strong>：您上传的图标文件存储在云端存储服务</li>
<li><strong>保留期限</strong>：根据您的套餐类型，文件保留时间为 3-90 天</li>
<li><strong>自动清理</strong>：超过保留期限的文件将被自动删除</li>
</ul>
<h4>1.2.3 分享链接功能</h4>
<p>当您使用分享链接功能时：</p>
<ul>
<li>我们将生成唯一的分享代码</li>
<li>分享链接的有效期根据您的套餐类型为 7-30 天</li>
<li>通过分享链接访问的用户可以下载您分享的应用文件</li>
<li><strong>我们不会收集通过分享链接访问的用户的个人信息</strong></li>
</ul>
<h3>1.3 构建配额管理</h3>
<p>我们会记录您的构建次数以管理每日配额：</p>
<ul>
<li><strong>Free 套餐</strong>：每日 5 次构建</li>
<li><strong>Pro 套餐</strong>：每日 50 次构建</li>
<li><strong>Team 套餐</strong>：每日 500 次构建</li>
</ul>
<p>配额信息存储在数据库中，每日自动重置。</p>
<hr />
<h2>二、支付与隐私</h2>
<h3>2.1 支持的支付方式</h3>
<h4>2.1.1 支付宝 (Alipay)</h4>
<ul>
<li><strong>收集信息</strong>：订单号、支付时间、支付金额</li>
<li><strong>不收集信息</strong>：我们不会获取您的支付宝账号、银行卡信息或支付密码</li>
<li><strong>数据传输</strong>：通过支付宝官方SDK与支付宝服务器直接通信</li>
<li><strong>隐私政策</strong>：请参阅<a href="https://render.alipay.com/p/yuyan/180020010001196791/preview.html" target="_blank" rel="noopener noreferrer">支付宝隐私政策</a></li>
</ul>
<h4>2.1.2 微信支付 (WeChat Pay)</h4>
<ul>
<li><strong>收集信息</strong>：订单号、支付时间、支付金额</li>
<li><strong>不收集信息</strong>：我们不会获取您的微信支付账号、银行卡信息或支付密码</li>
<li><strong>数据传输</strong>：通过微信支付 V3 API 与微信支付服务器直接通信</li>
<li><strong>隐私政策</strong>：请参阅<a href="https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml" target="_blank" rel="noopener noreferrer">微信支付隐私政策</a></li>
</ul>
<h3>2.2 交易记录保留</h3>
<p>我们将保留以下交易信息用于售后服务和财务合规：</p>
<ul>
<li>订单唯一标识符</li>
<li>支付提供商订单号</li>
<li>支付金额和货币类型</li>
<li>支付状态和完成时间</li>
<li>购买的套餐类型（Free/Pro/Team）</li>
<li>订阅周期（月付/年付）</li>
</ul>
<h3>2.3 订阅管理</h3>
<ul>
<li>订阅信息存储在数据库中</li>
<li>包括订阅状态、开始时间、到期时间、自动续费设置</li>
<li>您可以随时在设置中查看和管理订阅</li>
</ul>
<hr />
<h2>三、数据分析与统计</h2>
<h3>3.1 使用统计</h3>
<p>为了改进服务质量，我们会收集以下匿名统计信息：</p>
<ul>
<li>构建次数统计（按平台分类）</li>
<li>构建成功率</li>
<li>平均构建时间</li>
<li>功能使用频率</li>
</ul>
<h3>3.2 设备信息</h3>
<p>我们可能收集以下设备信息用于服务优化：</p>
<ul>
<li>设备类型（桌面/移动/平板）</li>
<li>操作系统（Windows/macOS/iOS/Android/Linux）</li>
<li>浏览器类型和版本</li>
<li>屏幕分辨率</li>
<li>浏览器语言</li>
</ul>
<h3>3.3 数据使用承诺</h3>
<ul>
<li><strong>我们不会向第三方出售您的个人信息</strong></li>
<li>统计数据仅用于内部分析和服务改进</li>
<li>所有统计数据均经过匿名化处理</li>
</ul>
<hr />
<h2>四、广告与第三方服务</h2>
<h3>4.1 广告展示规则</h3>
<ul>
<li><strong>广告位置</strong>：页面顶部、底部、侧边栏</li>
<li><strong>广告类型</strong>：图片广告、视频广告</li>
<li><strong>广告管理</strong>：您可以在设置中选择是否显示广告</li>
</ul>
<h3>4.2 订阅用户去广告权益</h3>
<ul>
<li>Pro/Team 订阅用户可以在设置中开启「隐藏广告」功能</li>
<li>开启后，应用内将不再展示任何广告</li>
</ul>
<h3>4.3 广告数据收集</h3>
<ul>
<li>我们的广告系统由自有服务器管理</li>
<li><strong>我们不会向第三方广告商共享您的个人信息</strong></li>
<li>广告展示基于位置参数，不基于您的个人画像</li>
</ul>
<hr />
<h2>五、内容规范与合规</h2>
<h3>5.1 服务使用规范</h3>
<p>请勿使用本服务构建以下类型的应用：</p>
<ul>
<li>违反中华人民共和国法律法规的应用</li>
<li>包含色情、暴力、血腥内容的应用</li>
<li>包含政治敏感信息的应用</li>
<li>侵犯他人合法权益的应用</li>
<li>包含恶意代码或病毒的应用</li>
<li>其他违反公序良俗的应用</li>
</ul>
<p><strong>处理措施</strong>：</p>
<ul>
<li>系统会自动检测违规内容</li>
<li>多次违规将导致账号封禁</li>
<li>我们保留依法向有关部门报告违法行为的权利</li>
</ul>
<h3>5.2 知识产权声明</h3>
<ul>
<li>您对上传的内容（URL、图标、应用名称等）拥有知识产权</li>
<li>您需确保上传的内容不侵犯第三方知识产权</li>
<li>因侵权产生的法律责任由您自行承担</li>
</ul>
<h3>5.3 免责声明</h3>
<blockquote><p><strong>重要提示</strong>：本服务仅提供应用构建技术支持，不对构建的应用内容负责。使用本服务构建的应用产生的任何后果由用户自行承担。</p></blockquote>
<hr />
<h2>六、构建记录管理</h2>
<h3>6.1 构建记录存储</h3>
<ul>
<li><strong>登录用户</strong>：构建记录保存在云端数据库中，可跨设备查看</li>
<li><strong>游客用户</strong>：不支持游客模式，必须登录后才能使用构建服务</li>
</ul>
<h3>6.2 构建文件保留期限</h3>
<p>根据您的套餐类型，构建文件的保留期限如下：</p>
<table>
<thead>
<tr>
<th style="text-align:center">套餐类型</th>
<th style="text-align:center">文件保留期限</th>
<th style="text-align:center">每日构建限额</th>
<th style="text-align:center">批量构建</th>
<th style="text-align:center">分享链接有效期</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">Free</td>
<td style="text-align:center">3 天</td>
<td style="text-align:center">5 次</td>
<td style="text-align:center">不支持</td>
<td style="text-align:center">不支持</td>
</tr>
<tr>
<td style="text-align:center">Pro</td>
<td style="text-align:center">14 天</td>
<td style="text-align:center">50 次</td>
<td style="text-align:center">支持</td>
<td style="text-align:center">7 天</td>
</tr>
<tr>
<td style="text-align:center">Team</td>
<td style="text-align:center">90 天</td>
<td style="text-align:center">500 次</td>
<td style="text-align:center">支持</td>
<td style="text-align:center">30 天</td>
</tr>
</tbody>
</table>
<blockquote><p>超过保留期限的文件将被自动删除且无法恢复。</p></blockquote>
<h3>6.3 构建记录信息</h3>
<p>我们保存的构建记录包括：</p>
<ul>
<li>构建时间</li>
<li>目标平台</li>
<li>应用名称</li>
<li>构建状态（成功/失败）</li>
<li>文件大小</li>
<li>下载次数</li>
</ul>
<hr />
<h2>七、账户删除</h2>
<h3>7.1 删除入口</h3>
<p>设置 → 隐私与安全 → 危险操作 → 删除账户</p>
<h3>7.2 删除警告</h3>
<blockquote><p><strong>危险警告</strong>：删除账户是<strong>不可恢复</strong>的操作。一旦删除，以下数据将被永久清除且无法找回：</p>
<ul>
<li>账户基本信息（邮箱、昵称、头像）</li>
<li>所有构建记录和历史文件</li>
<li><strong>剩余的订阅时长将被作废，不予退款</strong></li>
<li>个人设置和偏好配置</li>
<li>所有上传的应用图标文件</li>
<li>所有分享链接将立即失效</li>
</ul></blockquote>
<h3>7.3 删除流程</h3>
<ol>
<li>进入「隐私与安全」设置</li>
<li>点击「删除账户」按钮</li>
<li>系统弹出确认对话框，明确告知不可恢复</li>
<li>确认后立即执行删除</li>
<li>删除完成后自动退出登录</li>
</ol>
<hr />
<h2>八、您的权利</h2>
<h3>8.1 访问权</h3>
<p>您有权访问我们收集的关于您的个人信息。</p>
<h3>8.2 更正权</h3>
<p>您有权更正您的个人信息（如昵称、头像等）。</p>
<h3>8.3 删除权</h3>
<p>您有权要求我们删除您的个人信息（参见第七章）。</p>
<h3>8.4 导出权</h3>
<p>您可以在「隐私与安全」设置中导出您的个人数据。</p>
<h3>8.5 撤回同意权</h3>
<p>您可以随时撤回对非必要功能的授权。</p>
<hr />
<h2>九、数据安全</h2>
<p>我们采取以下安全措施保护您的个人数据：</p>
<ul>
<li>数据传输加密（TLS/SSL）</li>
<li>密码安全哈希（bcrypt）</li>
<li>访问控制和身份验证</li>
<li>定期安全评估</li>
<li>文件存储加密</li>
</ul>
<p>但是，没有任何系统是完全安全的。我们无法保证您的数据绝对安全。</p>
<hr />
<h2>十、数据保留</h2>
<p>我们仅在必要期限内保留您的个人数据：</p>
<ul>
<li><strong>账户数据</strong>：直到您删除账户</li>
<li><strong>构建记录</strong>：根据套餐类型保留 3-90 天</li>
<li><strong>交易记录</strong>：根据法律要求保留（通常为 7 年）</li>
<li><strong>服务器日志</strong>：通常保留 90 天用于安全和调试</li>
</ul>
<hr />
<h2>十一、未成年人保护</h2>
<p>本服务不面向 14 周岁以下的儿童。如果您是未成年人的监护人，发现您的孩子向我们提供了个人信息，请联系我们删除。</p>
<hr />
<h2>十二、隐私政策更新</h2>
<p>我们可能会不时更新本隐私政策。更新后的政策将在本页面发布，重大变更将通过应用内通知或电子邮件告知您。</p>
<hr />
<h2>十三、联系我们</h2>
<p>如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：</p>
<ul>
<li><strong>邮箱</strong>：mornscience@gmail.com</li>
<li><strong>服务时间</strong>：周一至周五 9:00-18:00（北京时间）</li>
</ul>
<hr />
<p><strong>Copyright © 2026 Yuxuan Zhou. All Rights Reserved.</strong></p>
`;

// 国内版英文隐私条款
const PRIVACY_EN_DOMESTIC = `
<h2>Privacy Policy (Domestic Edition)</h2>
<p><strong>Effective Date:</strong> January 24, 2026</p>
<p>Please refer to the Chinese version for complete terms.</p>
`;

// 国际版中文隐私条款
const PRIVACY_CN_INTERNATIONAL = `
<h2>隐私政策（国际版）</h2>
<p><strong>生效日期：</strong>2026年1月24日</p>
<p>请参阅英文版本以获取完整条款。</p>
`;

// 国际版英文隐私条款
const PRIVACY_EN_INTERNATIONAL = `
<h1>Privacy Policy (Global Edition)</h1>
<p><strong>Applicable Edition</strong>: App Builder Platform Global Edition</p>
<p><strong>Compliance</strong>: GDPR (EU), CCPA (California), COPPA, and other applicable international data protection regulations.</p>
<p><strong>Effective Date</strong>: January 24, 2026</p>
<p><strong>Last Updated</strong>: January 24, 2026</p>
<hr />
<p>App Builder Platform ("we," "us," or "our") is committed to protecting your privacy. This policy applies to our app building services accessed through web platforms.</p>
<hr />
<h2>1. Data Collection and Usage</h2>
<h3>1.1 Account Registration & Authentication</h3>
<h4>1.1.1 Email Registration</h4>
<p>When you register or sign in with email, we collect:</p>
<ul>
<li><strong>Email address</strong>: For account registration, authentication, and account recovery</li>
<li><strong>Encrypted password</strong>: Stored using bcrypt hashing (salt rounds: 10). We cannot access your plain-text password.</li>
</ul>
<h4>1.1.2 Google Sign-In (OAuth)</h4>
<p>When you sign in with Google, we collect through Google's OAuth service:</p>
<ul>
<li><strong>Google unique ID</strong>: Your unique identifier within our application</li>
<li><strong>Email address</strong>: Associated with your Google account</li>
<li><strong>Display name</strong>: Your Google profile name</li>
<li><strong>Profile picture</strong>: Your Google avatar (optional)</li>
</ul>
<blockquote><p>**Legal Basis**: We process this data based on contract performance (GDPR Article 6(1)(b)) - providing the service you requested.</p></blockquote>
<h3>1.2 Core Service Features</h3>
<h4>1.2.1 App Building Service</h4>
<p>When you use our app building service, we collect and process the following information:</p>
<p><strong>Required Information</strong>:</p>
<ul>
<li><strong>Target Website URL</strong>: The web address you want to convert into an app</li>
<li><strong>App Name</strong>: The name you set for your application</li>
<li><strong>App Icon</strong> (optional): Icon file you upload (PNG, JPEG, GIF, WebP formats, max 10MB)</li>
<li><strong>App Description</strong> (optional): Brief description of your app</li>
</ul>
<p><strong>Platform-Specific Configuration</strong>:</p>
<ul>
<li><strong>Android</strong>: Package Name, Version Name, Version Code, Privacy Policy URL</li>
<li><strong>iOS</strong>: Bundle ID, Version String, Build Number, Privacy Policy URL</li>
<li><strong>HarmonyOS</strong>: Bundle Name, Version Name, Version Code, Privacy Policy URL</li>
<li><strong>Windows/Mac/Linux</strong>: App Name, App Icon</li>
<li><strong>Chrome Extension</strong>: Extension Name, Version, Description, Icon</li>
<li><strong>WeChat Mini Program</strong>: AppID, Version</li>
</ul>
<p><strong>Data Usage Purposes</strong>:</p>
<ul>
<li>Generate application packages for corresponding platforms</li>
<li>Save build records for your viewing and downloading</li>
<li>Provide build history and management features</li>
</ul>
<h4>1.2.2 File Storage & Management</h4>
<ul>
<li><strong>Build Files</strong>: Generated app packages are stored in cloud storage services (Tencent Cloud CloudBase / Supabase Storage)</li>
<li><strong>App Icons</strong>: Icon files you upload are stored in cloud storage services</li>
<li><strong>Retention Period</strong>: Files are retained for 3-90 days based on your subscription plan</li>
<li><strong>Automatic Cleanup</strong>: Files exceeding the retention period will be automatically deleted</li>
</ul>
<h4>1.2.3 Share Link Feature</h4>
<p>When you use the share link feature:</p>
<ul>
<li>We generate a unique share code</li>
<li>Share links are valid for 7-30 days based on your subscription plan</li>
<li>Users accessing the share link can download your shared app files</li>
<li><strong>We do NOT collect personal information from users accessing share links</strong></li>
</ul>
<h3>1.3 Build Quota Management</h3>
<p>We track your build count to manage daily quotas:</p>
<ul>
<li><strong>Free Plan</strong>: 5 builds per day</li>
<li><strong>Pro Plan</strong>: 50 builds per day</li>
<li><strong>Team Plan</strong>: 500 builds per day</li>
</ul>
<p>Quota information is stored in our database and automatically resets daily.</p>
<hr />
<h2>2. Payment & Privacy</h2>
<h3>2.1 Supported Payment Methods</h3>
<h4>2.1.1 Stripe</h4>
<ul>
<li><strong>Data Collected</strong>: Order ID, payment time, payment amount</li>
<li><strong>Data NOT Collected</strong>: We do not obtain your credit card number, CVV, or banking credentials</li>
<li><strong>Data Transmission</strong>: Direct communication with Stripe servers via official Stripe SDK</li>
<li><strong>Security</strong>: Stripe is PCI DSS Level 1 certified</li>
<li><strong>Privacy Policy</strong>: See <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a></li>
</ul>
<h4>2.1.2 PayPal</h4>
<ul>
<li><strong>Data Collected</strong>: Order ID, payment time, payment amount</li>
<li><strong>Data NOT Collected</strong>: We do not obtain your PayPal account credentials or linked payment details</li>
<li><strong>Data Transmission</strong>: Direct communication with PayPal servers via official PayPal SDK</li>
<li><strong>Privacy Policy</strong>: See <a href="https://www.paypal.com/us/legalhub/privacy-full" target="_blank" rel="noopener noreferrer">PayPal Privacy Policy</a></li>
</ul>
<h3>2.2 Transaction Record Retention</h3>
<p>We retain the following transaction information for after-sales service and financial compliance:</p>
<ul>
<li>Unique order identifier</li>
<li>Payment provider order ID</li>
<li>Payment amount and currency type</li>
<li>Payment status and completion time</li>
<li>Purchased plan type (Free/Pro/Team)</li>
<li>Subscription cycle (monthly/annual)</li>
</ul>
<h3>2.3 Subscription Management</h3>
<ul>
<li>Subscription information is stored in our database</li>
<li>Includes subscription status, start time, expiration time, auto-renewal settings</li>
<li>You can view and manage subscriptions in settings at any time</li>
</ul>
<h3>2.4 Currency Handling</h3>
<ul>
<li>International edition prices are in USD</li>
<li>Automatic currency conversion may be applied by your payment provider</li>
<li>Exchange rates are determined by the payment provider at the time of transaction</li>
</ul>
<hr />
<h2>3. Analytics & Statistics</h2>
<h3>3.1 Usage Statistics</h3>
<p>To improve service quality, we collect the following anonymous statistics:</p>
<ul>
<li>Build count statistics (by platform)</li>
<li>Build success rate</li>
<li>Average build time</li>
<li>Feature usage frequency</li>
</ul>
<h3>3.2 Device Information</h3>
<p>We may collect the following device information for service optimization:</p>
<ul>
<li>Device type (desktop/mobile/tablet)</li>
<li>Operating system (Windows/macOS/iOS/Android/Linux)</li>
<li>Browser type and version</li>
<li>Screen resolution</li>
<li>Browser language</li>
</ul>
<h3>3.3 Data Usage Commitment</h3>
<ul>
<li><strong>We do NOT sell your personal information to third parties</strong></li>
<li>Statistical data is used only for internal analysis and service improvement</li>
<li>All statistical data is anonymized</li>
</ul>
<hr />
<h2>4. Advertising & Third-Party Services</h2>
<h3>4.1 Advertising Display Rules</h3>
<ul>
<li><strong>Ad Positions</strong>: Top, bottom, sidebar</li>
<li><strong>Ad Types</strong>: Image ads, video ads</li>
<li><strong>Ad Management</strong>: You can choose whether to display ads in Settings</li>
</ul>
<h3>4.2 Ad-Free Benefits for Subscribers</h3>
<ul>
<li>Pro/Team subscribers can enable "Hide Ads" in Settings</li>
<li>When enabled, no advertisements will be displayed in the application</li>
</ul>
<h3>4.3 Advertising Data Collection</h3>
<ul>
<li>Our advertising system is managed by our own servers</li>
<li><strong>We do NOT share your personal information with third-party advertisers</strong></li>
<li>Ad display is based on position parameters, NOT on your personal profile</li>
</ul>
<hr />
<h2>5. Content Guidelines & Compliance</h2>
<h3>5.1 Service Usage Guidelines</h3>
<p>Do NOT use this service to build applications that contain:</p>
<ul>
<li>Illegal content under applicable laws</li>
<li>Pornographic, violent, or graphic content</li>
<li>Content that infringes on others' legal rights</li>
<li>Malicious code or viruses</li>
<li>Other content that violates public order and morals</li>
</ul>
<p><strong>Consequences</strong>:</p>
<ul>
<li>System will automatically detect prohibited content</li>
<li>Multiple violations will result in account suspension</li>
<li>We reserve the right to report illegal activities to relevant authorities</li>
</ul>
<h3>5.2 Intellectual Property Statement</h3>
<ul>
<li>You own the intellectual property rights to the content you upload (URL, icons, app names, etc.)</li>
<li>You must ensure that uploaded content does not infringe on third-party intellectual property rights</li>
<li>You are solely responsible for any legal liability arising from infringement</li>
</ul>
<h3>5.3 Disclaimer</h3>
<blockquote><p>**IMPORTANT**: This service only provides app building technical support and is not responsible for the content of built applications. Users bear all responsibility for any consequences arising from applications built using this service.</p></blockquote>
<hr />
<h2>6. Build Record Management</h2>
<h3>6.1 Build Record Storage</h3>
<ul>
<li><strong>Logged-in Users</strong>: Build records are saved in cloud database, accessible across devices</li>
<li><strong>Guest Users</strong>: Guest mode is not supported; login is required to use build services</li>
</ul>
<h3>6.2 Build File Retention Period</h3>
<p>Based on your subscription plan, build file retention periods are as follows:</p>
<table>
<thead>
<tr>
<th style="text-align:center">Plan Type</th>
<th style="text-align:center">File Retention</th>
<th style="text-align:center">Daily Build Limit</th>
<th style="text-align:center">Batch Build</th>
<th style="text-align:center">Share Link Validity</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:center">Free</td>
<td style="text-align:center">3 days</td>
<td style="text-align:center">5 builds</td>
<td style="text-align:center">Not supported</td>
<td style="text-align:center">Not supported</td>
</tr>
<tr>
<td style="text-align:center">Pro</td>
<td style="text-align:center">14 days</td>
<td style="text-align:center">50 builds</td>
<td style="text-align:center">Supported</td>
<td style="text-align:center">7 days</td>
</tr>
<tr>
<td style="text-align:center">Team</td>
<td style="text-align:center">90 days</td>
<td style="text-align:center">500 builds</td>
<td style="text-align:center">Supported</td>
<td style="text-align:center">30 days</td>
</tr>
</tbody>
</table>
<blockquote><p>Files exceeding the retention period will be automatically deleted and cannot be recovered.</p></blockquote>
<h3>6.3 Build Record Information</h3>
<p>We save the following build record information:</p>
<ul>
<li>Build time</li>
<li>Target platform</li>
<li>App name</li>
<li>Build status (success/failure)</li>
<li>File size</li>
<li>Download count</li>
</ul>
<hr />
<h2>7. Account Deletion</h2>
<h3>7.1 Deletion Entry Point</h3>
<p>Settings → Privacy & Security → Danger Zone → Delete Account</p>
<h3>7.2 Deletion Warning</h3>
<blockquote><p>**DANGER WARNING**: Account deletion is an **irreversible** operation. Once deleted, the following data will be **permanently erased and CANNOT be recovered**: - Basic account information (email, name, avatar) - All build records and history files - **Remaining subscription time will be forfeited with NO refund** - Personal settings and preferences - All uploaded app icon files - All share links will immediately become invalid</p></blockquote>
<h3>7.3 Deletion Process</h3>
<p>1. Navigate to "Privacy & Security" settings</p>
<p>2. Click "Delete Account" button</p>
<p>3. System displays confirmation dialog clearly stating irreversibility</p>
<p>4. Upon confirmation, deletion executes immediately</p>
<p>5. After deletion, you are automatically logged out</p>
<hr />
<h2>8. Your Rights</h2>
<h3>8.1 Right of Access (GDPR Article 15)</h3>
<p>You have the right to access the personal information we have collected about you.</p>
<h3>8.2 Right to Rectification (GDPR Article 16)</h3>
<p>You have the right to correct your personal information (e.g., name, avatar).</p>
<h3>8.3 Right to Erasure (GDPR Article 17)</h3>
<p>You have the right to request deletion of your personal information (see Section 7).</p>
<h3>8.4 Right to Data Portability (GDPR Article 20)</h3>
<p>You can export your personal data in the "Privacy & Security" settings.</p>
<h3>8.5 Right to Withdraw Consent (GDPR Article 7)</h3>
<p>You may withdraw consent for non-essential features at any time.</p>
<h3>8.6 Right to Object (GDPR Article 21)</h3>
<p>You have the right to object to certain data processing activities.</p>
<h3>8.7 CCPA Rights (California Residents)</h3>
<p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):</p>
<ul>
<li>Right to know what personal information is collected</li>
<li>Right to know whether personal information is sold or disclosed</li>
<li>Right to opt out of the sale of personal information</li>
<li>Right to non-discrimination for exercising your rights</li>
</ul>
<p><strong>We do NOT sell your personal information.</strong></p>
<hr />
<h2>9. International Data Transfers</h2>
<p>Your data may be transferred to and processed in countries outside your country of residence. We ensure appropriate safeguards are in place, including:</p>
<ul>
<li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
<li>Compliance with applicable data protection regulations</li>
</ul>
<hr />
<h2>10. Children's Privacy</h2>
<p>Our service is NOT directed to children under the age of 13 (or 16 in the EU). If you are a guardian and discover that your child has provided us with personal information, please contact us for deletion.</p>
<hr />
<h2>11. Data Security</h2>
<p>We implement appropriate technical and organizational measures to protect your personal data, including:</p>
<ul>
<li>Encryption of data in transit (TLS/SSL)</li>
<li>Secure password hashing (bcrypt)</li>
<li>Access controls and authentication</li>
<li>Regular security assessments</li>
<li>File storage encryption</li>
</ul>
<p>However, no system is completely secure. We cannot guarantee absolute security of your data.</p>
<hr />
<h2>12. Data Retention</h2>
<p>We retain your personal data only for as long as necessary:</p>
<ul>
<li><strong>Account data</strong>: Until you delete your account</li>
<li><strong>Build records</strong>: 3-90 days based on subscription plan</li>
<li><strong>Transaction records</strong>: As required by applicable laws (typically 7 years)</li>
<li><strong>Server logs</strong>: Typically 90 days for security and debugging purposes</li>
</ul>
<hr />
<h2>13. Privacy Policy Updates</h2>
<p>We may update this Privacy Policy from time to time. Updated policies will be posted on this page. Significant changes will be communicated through in-app notifications or email.</p>
<hr />
<h2>14. Contact Us</h2>
<p>If you have any questions or suggestions about this Privacy Policy, please contact us:</p>
<ul>
<li><strong>Email</strong>: mornscience@gmail.com</li>
<li><strong>Business Hours</strong>: Monday to Friday, 9:00 AM - 6:00 PM (UTC)</li>
</ul>
<p>For EU residents, you also have the right to lodge a complaint with a supervisory authority.</p>
<hr />
<p><strong>Copyright © 2026 Yuxuan Zhou. All Rights Reserved.</strong></p>
`;
