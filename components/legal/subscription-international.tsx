"use client";

import { MarkdownRenderer } from "./markdown-renderer";

const SUBSCRIPTION_CONTENT = `# Subscription Terms (Global Edition)

**Applicable Edition**: App Builder Platform Global Edition

**Effective Date**: January 24, 2026

**Last Updated**: January 24, 2026

---

## 1. Subscription Plans

| Plan | Monthly Price | Annual Price (per month) | Daily Build Limit | File Retention | Batch Build | Share Link Validity |
|:---:|:-------------:|:------------------------:|:-----------------:|:--------------:|:-----------:|:-------------------:|
| Free | Free | - | 5 builds | 3 days | ❌ | ❌ |
| Pro | $9.99 | $6.99 | 50 builds | 14 days | ✅ | 7 days |
| Team | $29.99 | $20.99 | 500 builds | 90 days | ✅ | 30 days |

> **Notes**:
> - **Daily Build Limit**: Automatically resets daily at 00:00 UTC
> - **File Retention**: Build files are automatically deleted after the retention period
> - **Batch Build**: Build applications for multiple platforms simultaneously
> - **Share Link**: Generate shareable download links for your applications

---

## 2. Subscription Calculation Rules

### 2.1 Same-tier Renewal (Extending the same plan)

When you renew the same subscription plan, the system automatically extends your expiration date:

- **Monthly Renewal**: Extends by 1 calendar month from current expiration date
- **Annual Renewal**: Extends by 12 calendar months from current expiration date
- **Month-end Stickiness Rule**: If your subscription date is the 31st, the system handles month differences intelligently
  - Example: Jan 31 monthly renewal → expires Feb 28 (or 29)
  - March renewal → expiration auto-adjusts back to Mar 31
  - We guarantee your subscription date won't permanently shift earlier due to month-length differences

### 2.2 Upgrading Subscription (Lower to Higher tier)

When upgrading from a lower-tier to a higher-tier plan:

1. **Calculate Remaining Value**: The system calculates remaining days of your current plan and prorates the value
   - Remaining Value = Remaining Days × (Current Plan Monthly Price ÷ 30)
2. **Value Conversion**: Remaining value is converted to days on the new plan
   - Converted Days = Remaining Value ÷ (New Plan Monthly Price ÷ 30)
3. **New Expiration Calculation**: New plan expires = Today + Converted Days + Purchased Period Days
4. **Effective Time**: Upgrade takes effect immediately
5. **Quota Handling**:
   - You immediately receive the new plan's daily build limit
   - File retention period is immediately extended to the new plan's standard
   - Existing build files have their retention period automatically extended

**Upgrade Example**:
\`\`\`
Current Plan: Pro ($9.99/month), 15 days remaining
Upgrade to: Team ($29.99/month), purchase 1 month

Calculation:
1. Remaining Value = 15 × (9.99 ÷ 30) = $4.995
2. Converted Days = 4.995 ÷ (29.99 ÷ 30) = 4.99 days ≈ 5 days
3. New Expiration = Today + 5 days + 30 days = 35 days from now
\`\`\`

### 2.3 Downgrading Subscription (Higher to Lower tier)

When downgrading from a higher-tier to a lower-tier plan:

1. **Delayed Effect**: Downgrade does NOT take effect immediately; it activates the day after your current plan expires
2. **Continue Enjoying**: You continue enjoying all higher-tier benefits until current plan expiration
3. **Quota Adjustment**: When downgrade activates, daily build limit adjusts to the new plan's limit
4. **File Handling**:
   - File retention period adjusts to the new plan's standard when downgrade takes effect
   - Files exceeding the new plan's retention period will be gradually cleaned up after downgrade
5. **Pending Status**: The system records your downgrade intent and auto-executes upon expiration

---

## 3. Quota Refresh Mechanism

### 3.1 Daily Build Limit

- **Refresh Time**: Automatically refreshes daily at 00:00 UTC
- **Refresh Rule**: Daily used count resets to 0
- **Quota Limits**:
  - Free: 5 builds/day
  - Pro: 50 builds/day
  - Team: 500 builds/day

### 3.2 File Retention Period

- **Calculation Method**: Calculated from build completion time
- **Automatic Cleanup**: Files exceeding the retention period are automatically deleted
- **Retention Periods**:
  - Free: 3 days
  - Pro: 14 days
  - Team: 90 days

### 3.3 Share Link Validity

- **Calculation Method**: Calculated from share link creation time
- **Automatic Expiration**: Share links exceeding the validity period automatically expire
- **Validity Periods**:
  - Free: Share feature not supported
  - Pro: 7 days
  - Team: 30 days

---

## 4. Feature Benefits Comparison

### 4.1 Build Features

| Feature | Free | Pro | Team |
|:-------:|:----:|:---:|:----:|
| Single Platform Build | ✅ | ✅ | ✅ |
| Batch Build | ❌ | ✅ | ✅ |
| Custom Icon | ✅ | ✅ | ✅ |
| Custom Configuration | ✅ | ✅ | ✅ |

### 4.2 File Management

| Feature | Free | Pro | Team |
|:-------:|:----:|:---:|:----:|
| Build History View | ✅ | ✅ | ✅ |
| File Download | ✅ | ✅ | ✅ |
| Share Links | ❌ | ✅ (7 days) | ✅ (30 days) |
| Build Record Export | ❌ | ✅ | ✅ |

### 4.3 Other Benefits

| Feature | Free | Pro | Team |
|:-------:|:----:|:---:|:----:|
| Advertisements | With Ads | Can Hide | Can Hide |
| Technical Support | Community | Email | Priority |
| API Access | ❌ | ❌ | ✅ |

---

## 5. Payment Methods

### 5.1 Stripe

- Instant payment processing
- Supports monthly and annual subscriptions
- Auto-renewal available (optional)

### 5.2 PayPal

- Secure payment processing
- Supports monthly and annual subscriptions
- Auto-renewal available (optional)

### 5.3 Auto-Renewal

- **Enable**: Check "Auto-renewal" option on subscription page
- **Charge Time**: Automatic charge 1 day before subscription expires
- **Charge Failure**: If charge fails, system retries once daily for 3 days after expiration
- **Disable**: Can be disabled anytime in settings
- **Effect**: After disabling, no auto-renewal after current subscription period ends

---

## 6. Changes & Renewal

### 6.1 Upgrade

- Upgrade takes effect immediately
- Remaining value automatically converts to new plan usage days
- Immediately receive full benefits of new plan
- File retention period immediately extended

### 6.2 Renewal

- After successful renewal, subscription date remains unchanged
- Expiration date extends from current expiration date
- Daily build limit continues to refresh according to plan standard

### 6.3 Downgrade

- Downgrade takes effect the day after current plan expires
- Continue enjoying current plan benefits until expiration
- When downgrade takes effect, quota adjusts to new plan standard

### 6.4 Expiration/Cancellation

- After subscription expires, automatically downgrade to Free plan
- Files exceeding Free plan retention period will be gradually cleaned up
- Share links immediately expire

---

## 7. Special Notes

### 7.1 Build Count Calculation

- **Successful Build**: Counts toward daily build limit
- **Failed Build**: Does NOT count toward daily build limit
- **Cancelled Build**: Does NOT count toward daily build limit
- **Batch Build**: Each platform counts as one build

### 7.2 File Storage

- All build files are stored on cloud servers
- No file size limit (max 2GB per file)
- Files exceeding retention period are automatically deleted and cannot be recovered
- Recommend downloading important files to local storage promptly

### 7.3 Share Link Rules

- Each build can generate one share link
- Share links can be password-protected (optional)
- Share links can be manually invalidated anytime
- Downloads via share links do NOT consume your build quota

---

## 8. Exceptions & Limitations

### 8.1 Payment Failure

If automatic renewal fails, the system will:
1. Retry once daily for 3 days after expiration
2. If still unsuccessful after 3 days, subscription automatically expires
3. After expiration, automatically downgrade to Free plan
4. You can manually renew anytime to restore subscription

### 8.2 Abuse Detection

The system monitors abnormal usage behavior, including but not limited to:
- Large number of build requests in short time
- Malicious building of prohibited applications
- Abuse of share link feature
- Other violations of Terms of Service

**Consequences**:
- First warning: System notification
- Second violation: Service suspended for 24 hours
- Third violation: Permanent account ban

### 8.3 Service Limitations

- Maximum 9 platforms per batch build
- Maximum 10MB per app icon
- Maximum 100 tasks in build queue
- API rate limiting (Team plan exclusive)

---

## 9. Refund Policy

### 9.1 Subscription Refunds

- **7-Day Money-Back Guarantee**: Within 7 days of first subscription, if no builds have been used, full refund available
- **Partial Refund**: Within 7 days of subscription, if some builds have been used, proportional refund available
- **No Refund**: After 7 days of subscription, refunds not supported
- **Account Deletion**: When deleting account, remaining subscription time will be forfeited with no refund

### 9.2 Refund Process

1. Contact customer service to request refund
2. Provide order number and refund reason
3. Customer service review (1-3 business days)
4. After approval, refund returns via original payment method (3-7 business days)

---

## 10. Contact Us

If you have any questions about these Subscription Terms, please contact us:

- **Email**: mornscience@gmail.com
- **Business Hours**: Monday to Friday, 9:00 AM - 6:00 PM (UTC)
- **Live Chat**: Weekdays 9:00 AM - 6:00 PM

---

**Copyright © 2026 Yuxuan Zhou. All Rights Reserved.**
`;

export function SubscriptionInternational() {
  return <MarkdownRenderer content={SUBSCRIPTION_CONTENT} />;
}
