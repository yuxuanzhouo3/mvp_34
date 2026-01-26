"use client";

import { MarkdownRenderer } from "./markdown-renderer";

const PRIVACY_CONTENT = `# Privacy Policy (Global Edition)

**Applicable Edition**: App Builder Platform Global Edition

**Compliance**: GDPR (EU), CCPA (California), COPPA, and other applicable international data protection regulations.

**Effective Date**: January 24, 2026

**Last Updated**: January 24, 2026

---

App Builder Platform ("we," "us," or "our") is committed to protecting your privacy. This policy applies to our app building services accessed through web platforms.

---

## 1. Data Collection and Usage

### 1.1 Account Registration & Authentication

#### 1.1.1 Email Registration
When you register or sign in with email, we collect:
- **Email address**: For account registration, authentication, and account recovery
- **Encrypted password**: Stored using bcrypt hashing (salt rounds: 10). We cannot access your plain-text password.

#### 1.1.2 Google Sign-In (OAuth)
When you sign in with Google, we collect through Google's OAuth service:
- **Google unique ID**: Your unique identifier within our application
- **Email address**: Associated with your Google account
- **Display name**: Your Google profile name
- **Profile picture**: Your Google avatar (optional)

> **Legal Basis**: We process this data based on contract performance (GDPR Article 6(1)(b)) - providing the service you requested.

### 1.2 Core Service Features

#### 1.2.1 App Building Service
When you use our app building service, we collect and process the following information:

**Required Information**:
- **Target Website URL**: The web address you want to convert into an app
- **App Name**: The name you set for your application
- **App Icon** (optional): Icon file you upload (PNG, JPEG, GIF, WebP formats, max 10MB)
- **App Description** (optional): Brief description of your app

**Platform-Specific Configuration**:
- **Android**: Package Name, Version Name, Version Code, Privacy Policy URL
- **iOS**: Bundle ID, Version String, Build Number, Privacy Policy URL
- **HarmonyOS**: Bundle Name, Version Name, Version Code, Privacy Policy URL
- **Windows/Mac/Linux**: App Name, App Icon
- **Chrome Extension**: Extension Name, Version, Description, Icon
- **WeChat Mini Program**: AppID, Version

**Data Usage Purposes**:
- Generate application packages for corresponding platforms
- Save build records for your viewing and downloading
- Provide build history and management features

#### 1.2.2 File Storage & Management
- **Build Files**: Generated app packages are stored in cloud storage services (Tencent Cloud CloudBase / Supabase Storage)
- **App Icons**: Icon files you upload are stored in cloud storage services
- **Retention Period**: Files are retained for 3-90 days based on your subscription plan
- **Automatic Cleanup**: Files exceeding the retention period will be automatically deleted

#### 1.2.3 Share Link Feature
When you use the share link feature:
- We generate a unique share code
- Share links are valid for 7-30 days based on your subscription plan
- Users accessing the share link can download your shared app files
- **We do NOT collect personal information from users accessing share links**

### 1.3 Build Quota Management

We track your build count to manage daily quotas:
- **Free Plan**: 5 builds per day
- **Pro Plan**: 50 builds per day
- **Team Plan**: 500 builds per day

Quota information is stored in our database and automatically resets daily.

---

## 2. Payment & Privacy

### 2.1 Supported Payment Methods

#### 2.1.1 Stripe
- **Data Collected**: Order ID, payment time, payment amount
- **Data NOT Collected**: We do not obtain your credit card number, CVV, or banking credentials
- **Data Transmission**: Direct communication with Stripe servers via official Stripe SDK
- **Security**: Stripe is PCI DSS Level 1 certified
- **Privacy Policy**: See [Stripe Privacy Policy](https://stripe.com/privacy)

#### 2.1.2 PayPal
- **Data Collected**: Order ID, payment time, payment amount
- **Data NOT Collected**: We do not obtain your PayPal account credentials or linked payment details
- **Data Transmission**: Direct communication with PayPal servers via official PayPal SDK
- **Privacy Policy**: See [PayPal Privacy Policy](https://www.paypal.com/us/legalhub/privacy-full)

### 2.2 Transaction Record Retention
We retain the following transaction information for after-sales service and financial compliance:
- Unique order identifier
- Payment provider order ID
- Payment amount and currency type
- Payment status and completion time
- Purchased plan type (Free/Pro/Team)
- Subscription cycle (monthly/annual)

### 2.3 Subscription Management
- Subscription information is stored in our database
- Includes subscription status, start time, expiration time, auto-renewal settings
- You can view and manage subscriptions in settings at any time

### 2.4 Currency Handling
- International edition prices are in USD
- Automatic currency conversion may be applied by your payment provider
- Exchange rates are determined by the payment provider at the time of transaction

---

## 3. Analytics & Statistics

### 3.1 Usage Statistics
To improve service quality, we collect the following anonymous statistics:
- Build count statistics (by platform)
- Build success rate
- Average build time
- Feature usage frequency

### 3.2 Device Information
We may collect the following device information for service optimization:
- Device type (desktop/mobile/tablet)
- Operating system (Windows/macOS/iOS/Android/Linux)
- Browser type and version
- Screen resolution
- Browser language

### 3.3 Data Usage Commitment
- **We do NOT sell your personal information to third parties**
- Statistical data is used only for internal analysis and service improvement
- All statistical data is anonymized

---

## 4. Advertising & Third-Party Services

### 4.1 Advertising Display Rules
- **Ad Positions**: Top, bottom, sidebar
- **Ad Types**: Image ads, video ads
- **Ad Management**: You can choose whether to display ads in Settings

### 4.2 Ad-Free Benefits for Subscribers
- Pro/Team subscribers can enable "Hide Ads" in Settings
- When enabled, no advertisements will be displayed in the application

### 4.3 Advertising Data Collection
- Our advertising system is managed by our own servers
- **We do NOT share your personal information with third-party advertisers**
- Ad display is based on position parameters, NOT on your personal profile

---

## 5. Content Guidelines & Compliance

### 5.1 Service Usage Guidelines
Do NOT use this service to build applications that contain:
- Illegal content under applicable laws
- Pornographic, violent, or graphic content
- Content that infringes on others' legal rights
- Malicious code or viruses
- Other content that violates public order and morals

**Consequences**:
- System will automatically detect prohibited content
- Multiple violations will result in account suspension
- We reserve the right to report illegal activities to relevant authorities

### 5.2 Intellectual Property Statement
- You own the intellectual property rights to the content you upload (URL, icons, app names, etc.)
- You must ensure that uploaded content does not infringe on third-party intellectual property rights
- You are solely responsible for any legal liability arising from infringement

### 5.3 Disclaimer
> **IMPORTANT**: This service only provides app building technical support and is not responsible for the content of built applications. Users bear all responsibility for any consequences arising from applications built using this service.

---

## 6. Build Record Management

### 6.1 Build Record Storage
- **Logged-in Users**: Build records are saved in cloud database, accessible across devices
- **Guest Users**: Guest mode is not supported; login is required to use build services

### 6.2 Build File Retention Period
Based on your subscription plan, build file retention periods are as follows:

| Plan Type | File Retention | Daily Build Limit | Batch Build | Share Link Validity |
|:---------:|:--------------:|:-----------------:|:-----------:|:-------------------:|
| Free      | 3 days         | 5 builds          | Not supported | Not supported     |
| Pro       | 14 days        | 50 builds         | Supported   | 7 days              |
| Team      | 90 days        | 500 builds        | Supported   | 30 days             |

> Files exceeding the retention period will be automatically deleted and cannot be recovered.

### 6.3 Build Record Information
We save the following build record information:
- Build time
- Target platform
- App name
- Build status (success/failure)
- File size
- Download count

---

## 7. Account Deletion

### 7.1 Deletion Entry Point
Settings → Privacy & Security → Danger Zone → Delete Account

### 7.2 Deletion Warning
> **DANGER WARNING**: Account deletion is an **irreversible** operation. Once deleted, the following data will be **permanently erased and CANNOT be recovered**:
> - Basic account information (email, name, avatar)
> - All build records and history files
> - **Remaining subscription time will be forfeited with NO refund**
> - Personal settings and preferences
> - All uploaded app icon files
> - All share links will immediately become invalid

### 7.3 Deletion Process
1. Navigate to "Privacy & Security" settings
2. Click "Delete Account" button
3. System displays confirmation dialog clearly stating irreversibility
4. Upon confirmation, deletion executes immediately
5. After deletion, you are automatically logged out

---

## 8. Your Rights

### 8.1 Right of Access (GDPR Article 15)
You have the right to access the personal information we have collected about you.

### 8.2 Right to Rectification (GDPR Article 16)
You have the right to correct your personal information (e.g., name, avatar).

### 8.3 Right to Erasure (GDPR Article 17)
You have the right to request deletion of your personal information (see Section 7).

### 8.4 Right to Data Portability (GDPR Article 20)
You can export your personal data in the "Privacy & Security" settings.

### 8.5 Right to Withdraw Consent (GDPR Article 7)
You may withdraw consent for non-essential features at any time.

### 8.6 Right to Object (GDPR Article 21)
You have the right to object to certain data processing activities.

### 8.7 CCPA Rights (California Residents)
If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
- Right to know what personal information is collected
- Right to know whether personal information is sold or disclosed
- Right to opt out of the sale of personal information
- Right to non-discrimination for exercising your rights

**We do NOT sell your personal information.**

---

## 9. International Data Transfers

Your data may be transferred to and processed in countries outside your country of residence. We ensure appropriate safeguards are in place, including:
- Standard Contractual Clauses (SCCs) approved by the European Commission
- Compliance with applicable data protection regulations

---

## 10. Children's Privacy

Our service is NOT directed to children under the age of 13 (or 16 in the EU). If you are a guardian and discover that your child has provided us with personal information, please contact us for deletion.

---

## 11. Data Security

We implement appropriate technical and organizational measures to protect your personal data, including:
- Encryption of data in transit (TLS/SSL)
- Secure password hashing (bcrypt)
- Access controls and authentication
- Regular security assessments
- File storage encryption

However, no system is completely secure. We cannot guarantee absolute security of your data.

---

## 12. Data Retention

We retain your personal data only for as long as necessary:
- **Account data**: Until you delete your account
- **Build records**: 3-90 days based on subscription plan
- **Transaction records**: As required by applicable laws (typically 7 years)
- **Server logs**: Typically 90 days for security and debugging purposes

---

## 13. Privacy Policy Updates

We may update this Privacy Policy from time to time. Updated policies will be posted on this page. Significant changes will be communicated through in-app notifications or email.

---

## 14. Contact Us

If you have any questions or suggestions about this Privacy Policy, please contact us:

- **Email**: mornscience@gmail.com
- **Business Hours**: Monday to Friday, 9:00 AM - 6:00 PM (UTC)

For EU residents, you also have the right to lodge a complaint with a supervisory authority.

---

**Copyright © 2026 Yuxuan Zhou. All Rights Reserved.**
`;

export function PrivacyInternational() {
  return <MarkdownRenderer content={PRIVACY_CONTENT} />;
}
