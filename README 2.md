# MVP 30 - MornClient

**Transform any URL into native apps for 5 platforms in minutes.**

A powerful client application for [MornScience.biz](https://mornscience.biz) that converts websites and app ideas into production-ready native applications.

## 🚀 Overview

MVP 30 (MornClient) is an AI-powered platform that generates native applications for multiple platforms from a single input - either a website URL or a text description. Within minutes, you can have apps ready for:

- 📱 **Android (APK)** - Google Play & Chinese Platforms
- 🍎 **iOS (IPA)** - App Store
- 💻 **macOS (DMG)** - Mac App Store & Direct Download
- 🪟 **Windows (EXE)** - Microsoft Store & Direct Download
- 🐧 **Linux (AppImage)** - Snap Store & Direct Download

## ✨ Features

### Core Functionality

- **URL to App Conversion**: Provide any website URL and instantly generate native apps
- **AI-Powered Generation**: Describe your app idea and let AI create it for you
- **Multi-Platform Support**: Generate for all 5 major platforms simultaneously
- **Real-Time Progress Tracking**: Monitor build progress for each platform
- **Automatic Analysis**: Extracts metadata, icons, and branding from URLs
- **Production-Ready Builds**: Apps are optimized and ready for store submission

### Technical Features

- **Metadata Extraction**: Automatically detects app name, description, icons, and colors
- **Framework Detection**: Identifies React, Next.js, Vue, Angular, and more
- **Responsive Analysis**: Checks if the source is mobile-friendly
- **WebView Wrapper**: Creates native wrappers for web content
- **Cross-Platform Building**: Uses React Native, Capacitor, and Electron

## 🏗️ Project Structure

```
mvp_30/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── generate/         # App generation endpoint
│   │   ├── jobs/             # Job management
│   │   └── downloads/        # Download endpoints
│   ├── dashboard/            # Dashboard page
│   ├── generate/             # Generation form page
│   └── page.tsx              # Home page
├── components/               # React components
│   ├── ui/                   # UI component library
│   ├── generate-form.tsx     # Main generation form
│   └── dashboard-content.tsx # Dashboard display
├── lib/                      # Core services
│   ├── url-analyzer.ts       # URL scraping & analysis
│   ├── job-manager.ts        # Job lifecycle management
│   ├── job-processor.ts      # Async job processing
│   └── app-generator.ts      # Platform-specific builders
└── README.md                 # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mornscience/mvp_30.git
cd mvp_30
```

2. Install dependencies:
```bash
pnpm install
```

3. Run the development server:
```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📖 Usage

### Converting a URL to Apps

1. Navigate to the **Generate** page
2. Select **Website URL** input method
3. Enter your website URL (e.g., `https://example.com`)
4. Provide an app name
5. Select target platforms (Android, iOS, macOS, Windows, Linux)
6. Click **Generate Apps**
7. Monitor progress on the Dashboard

### Creating an App from Description

1. Navigate to the **Generate** page
2. Select **Describe Your App** input method
3. Write a description of your app idea
4. Provide an app name
5. Select target platforms
6. Click **Generate Apps**
7. Monitor progress and download when ready

## 🛠️ Development

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI
- **State Management**: React Hooks
- **Package Manager**: pnpm

### Key Services

#### URL Analyzer (`lib/url-analyzer.ts`)
- Validates and analyzes website URLs
- Extracts metadata (title, description, icons, colors)
- Detects frameworks and responsive design
- Determines content type (static, dynamic, SPA)

#### Job Manager (`lib/job-manager.ts`)
- Creates and tracks generation jobs
- Manages job lifecycle and status
- Updates build progress per platform
- In-memory storage (can be replaced with DB)

#### Job Processor (`lib/job-processor.ts`)
- Processes jobs asynchronously
- Coordinates multi-platform builds
- Handles errors and retries
- Updates real-time progress

#### App Generator (`lib/app-generator.ts`)
- Platform-specific build logic
- WebView configuration for URL-based apps
- AI-powered UI generation for descriptions
- Branding and icon application
- Code signing and packaging

### API Endpoints

- `POST /api/generate` - Create new generation job
- `GET /api/jobs` - List all jobs
- `GET /api/jobs/[id]` - Get job status
- `DELETE /api/jobs/[id]` - Delete job
- `GET /api/downloads/[filename]` - Download generated app

## 🔧 Configuration

### Build Times (Estimated)

- Android: ~3 minutes
- iOS: ~4 minutes  
- macOS: ~3.5 minutes
- Windows: ~3.7 minutes
- Linux: ~3.2 minutes

### Output Formats

- Android: APK (45-55 MB)
- iOS: IPA (50-60 MB)
- macOS: DMG (75-90 MB)
- Windows: EXE (80-100 MB)
- Linux: AppImage (70-85 MB)

## 🚢 Production Deployment

For production use, you should:

1. Replace in-memory job storage with a database (PostgreSQL, MongoDB)
2. Implement actual build services (EAS Build, Electron Builder, etc.)
3. Set up file storage (S3, GCS) for generated apps
4. Add authentication and user management
5. Implement payment/subscription system
6. Add analytics and monitoring
7. Set up CI/CD pipelines

## 📝 License

*License information to be specified based on project requirements.*

## 📧 Contact

For more information about MornScience.biz and our services:

- Website: [https://mornscience.biz](https://mornscience.biz)
- Project: MVP 30 (MornClient)

---

**Built with ❤️ by MornScience.biz**
