# 📱 90Plus Mobile App

> A football social media platform with real-time updates, video content, predictions, and gamification.

[![React Native](https://img.shields.io/badge/React%20Native-0.83.2-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2052-000020.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## ✨ Features

- 🎥 **Video Reels** - Share and watch football highlights
- ⚽ **Match Predictions** - Predict match outcomes and earn coins
- 🧠 **Quiz System** - Test your football knowledge
- 🏆 **Gamification** - Coins, levels, and achievements
- 🔔 **Real-time Updates** - Live match scores and notifications
- 🌍 **Multi-language** - 8 languages with RTL support
- 🎨 **Dark Mode** - Beautiful UI with theme support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm start
```

### Development

```bash
# Start with LAN
npm start

# Start with tunnel (for physical devices)
npm run start:tunnel

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web
npm run web
```

## 📚 Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[Architecture](./docs/ARCHITECTURE.md)** - System design and patterns
- **[Security](./docs/SECURITY.md)** - Security best practices
- **[Testing](./docs/TESTING.md)** - Testing strategy and guides
- **[Monitoring](./docs/MONITORING.md)** - Analytics and error tracking
- **[Contributing](./docs/CONTRIBUTING.md)** - How to contribute
- **[API Reference](./docs/API.md)** - API documentation

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Check for console.log statements
npm run check:console

# Check TypeScript types
npm run check:types

# Run all checks
npm run check:all
```

## 🏗️ Project Structure

```
front/
├── app/                    # Screens (file-based routing)
├── components/            # React components
├── services/              # Business logic & API (32 services)
├── hooks/                 # Custom hooks (17 hooks)
├── contexts/              # React Context (6 contexts)
├── src/
│   ├── store/            # Zustand stores (10 stores)
│   └── i18n/             # Internationalization
├── docs/                  # Documentation
├── types/                 # TypeScript types
└── locales/               # Translations (8 languages)
```

## 🔧 Tech Stack

- **React Native** 0.83.2
- **Expo SDK** 52
- **TypeScript** (strict mode)
- **expo-router** (file-based routing)
- **Zustand** (global state)
- **React Query** (server state)
- **Clerk** (authentication)
- **Socket.io** (real-time)
- **Jest** (testing)

## 🌍 Supported Languages

- 🇬🇧 English
- 🇸🇦 Arabic (RTL)
- 🇪🇸 Spanish
- 🇫🇷 French
- 🇩🇪 German
- 🇮🇹 Italian
- 🇵🇹 Portuguese
- 🇹🇷 Turkish

## 📊 Code Quality

- ✅ TypeScript strict mode
- ✅ ESLint configured
- ✅ Prettier configured
- ✅ Pre-commit checks
- ✅ Automated testing
- ✅ Code coverage tracking

## 🔐 Security

- ✅ Environment variables for secrets
- ✅ Secure token storage (SecureStore)
- ✅ HTTPS in production
- ✅ Input validation
- ✅ Error sanitization

See [SECURITY.md](./docs/SECURITY.md) for details.

## 🚀 Deployment

### EAS Build

```bash
# Build for development
eas build --profile development --platform ios

# Build for production
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## 📈 Monitoring (Planned)

- ⏳ Sentry for error tracking
- ⏳ Firebase Analytics
- ⏳ Performance monitoring
- ⏳ Custom dashboards

See [MONITORING.md](./docs/MONITORING.md) for setup.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and checks
5. Submit a pull request

## 📝 License

[Your License Here]

## 🙏 Acknowledgments

- Expo team for the amazing framework
- React Native community
- All contributors

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/90plus/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/90plus/discussions)
- **Email**: dev@90plus.app

---

Made with ❤️ for football fans worldwide ⚽
