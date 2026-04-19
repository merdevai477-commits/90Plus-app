# 📱 90Plus Mobile App Documentation

Welcome to the 90Plus mobile app documentation! This directory contains comprehensive guides for developers working on the project.

## 📚 Documentation Index

### Getting Started
- **[Architecture](./ARCHITECTURE.md)** - System architecture, patterns, and data flow
- **[Contributing](./CONTRIBUTING.md)** - How to contribute to the project
- **[API Reference](./API.md)** - API endpoints and service documentation

### Development
- **[Testing Guide](./TESTING.md)** - Testing strategy, tools, and best practices
- **[Security Guidelines](./SECURITY.md)** - Security best practices and compliance
- **[Monitoring & Analytics](./MONITORING.md)** - Observability and tracking setup

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm start

# Run tests
npm test

# Build for production
npm run build:prod
```

## 📖 Key Concepts

### File-Based Routing
We use expo-router for navigation. Files in `app/` directory automatically become routes.

### State Management
- **Zustand**: Global app state
- **React Query**: Server state & caching
- **Context API**: Shared state
- **Local State**: UI-only state

### Internationalization
8 languages supported with full RTL support for Arabic.

### Real-time Features
WebSocket integration for live updates (matches, notifications, comments).

## 🔧 Development Tools

- **TypeScript**: Type safety
- **Jest**: Testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting

## 📊 Project Stats

- **Components**: 100+
- **Services**: 32
- **Hooks**: 17
- **Contexts**: 6
- **Zustand Stores**: 10
- **Languages**: 8
- **Test Files**: 13

## 🎯 Current Focus

- ⏳ Improving test coverage (Target: 70%)
- ⏳ Adding error tracking (Sentry)
- ⏳ Implementing analytics (Firebase)
- ⏳ Performance optimization
- ⏳ Documentation completion

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## 📞 Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: dev@90plus.app

## 📄 License

[Your License Here]
