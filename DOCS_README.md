# NUBI Documentation Site

This directory contains the complete Starlight documentation site for NUBI - The Symbiotic Essence of Anubis AI Agent.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Git

### Local Development

```bash
# Install dependencies (if not already installed)
bun install

# Start the documentation server
npx astro dev

# Or add to package.json scripts:
bun run docs:dev
```

The documentation site will be available at `http://localhost:4321`.

## 📁 Structure

```
src/
├── components/          # Interactive components
│   ├── ApiExplorer.astro    # Interactive API testing
│   ├── SocketDemo.astro     # Live Socket.IO demo
│   ├── Hero.astro          # Custom hero component
│   └── Head.astro          # Custom head component
├── content/
│   └── docs/           # Documentation pages (MDX)
│       ├── index.mdx       # Homepage
│       ├── getting-started/
│       ├── ux-integration/
│       ├── database/
│       ├── telegram-raids/
│       └── api/
├── styles/
│   └── custom.css      # Custom NUBI branding
└── assets/             # Images and assets
```

## ✨ Features

### Interactive Components

- **API Explorer**: Live API endpoint testing with request/response
- **Socket.IO Demo**: Real-time communication simulation  
- **Two-Layer Processing**: Visualized security and classification pipeline
- **Interactive Diagrams**: System architecture and data flow

### Advanced Theming

- **NUBI Jackal Spirit**: Egyptian mythology inspired design
- **Custom Color Palette**: Gold, black, and blue theme
- **Responsive Design**: Mobile-first approach
- **Dark Mode**: Optimized for developer experience

### Content Features

- **MDX Integration**: React components in Markdown
- **Code Highlighting**: Night Owl and Min Light themes
- **Search**: Full-text search across all documentation
- **Navigation**: Comprehensive sidebar with NUBI's architecture

## 🎨 Customization

### Colors & Branding

Edit `src/styles/custom.css` to customize the NUBI brand colors:

```css
:root {
  --nubi-jackal-gold: #d4af37;
  --nubi-shadow-black: #0d0a08;
  --nubi-spirit-blue: #3f51b5;
  --nubi-ancient-bronze: #cd7f32;
  --nubi-mystic-purple: #663399;
}
```

### Components

Override Starlight components in `astro.config.mjs`:

```js
components: {
  Head: './src/components/Head.astro',
  Hero: './src/components/Hero.astro',
}
```

### Navigation

Edit the sidebar configuration in `astro.config.mjs` to match NUBI's modular architecture.

## 🔧 Development Commands

```bash
# Development server
npx astro dev

# Build for production
npx astro build

# Preview production build
npx astro preview

# Type checking
npx astro check

# Format code
npx prettier --write src/
```

## 🚀 Deployment

### GitHub Pages (Recommended)

The repository includes a GitHub Actions workflow (`.github/workflows/deploy-docs.yml`) that automatically:

1. Builds the documentation on push to main
2. Deploys to GitHub Pages
3. Runs Lighthouse performance audits
4. Generates SEO reports

### Manual Deployment

```bash
# Build the site
npx astro build

# Deploy the dist/ folder to your hosting provider
```

### Vercel/Netlify

Simply connect your repository to Vercel or Netlify with these settings:

- **Build Command**: `npx astro build`
- **Output Directory**: `dist`
- **Node Version**: 18+

## 📊 Performance & SEO

The documentation site is optimized for:

- **Lighthouse Score**: 95+ across all metrics
- **Core Web Vitals**: Excellent FCP, LCP, CLS scores
- **SEO**: Complete meta tags, structured data, sitemap
- **Accessibility**: WCAG 2.1 AA compliance
- **Performance**: Code splitting, lazy loading, optimized images

## 🧪 Interactive Demos

The site includes several interactive demonstrations:

### API Explorer
- Live API endpoint testing
- Request/response visualization
- Authentication handling
- Error simulation

### Socket.IO Demo
- Real-time connection simulation
- Two-layer processing visualization
- Message classification examples
- Persona routing demonstration

## 📚 Content Guidelines

When adding new documentation:

1. **Use MDX format** for rich content with components
2. **Follow the established structure** matching NUBI's architecture  
3. **Include interactive examples** where appropriate
4. **Maintain consistent tone** - technical but accessible
5. **Add to sidebar navigation** in `astro.config.mjs`

### Example Page Template

```mdx
---
title: Your Page Title
description: SEO-friendly description
---

import { Card, CardGrid, Aside } from '@astrojs/starlight/components';
import ApiExplorer from '../../../components/ApiExplorer.astro';

# Your Page Title

Brief introduction explaining the concept.

## Key Features

<CardGrid>
  <Card title="Feature 1" icon="rocket">
    Description of the feature
  </Card>
  <Card title="Feature 2" icon="approve-check">  
    Description of the feature
  </Card>
</CardGrid>

<ApiExplorer 
  title="Test Endpoint"
  endpoint="/api/example"
  method="GET"
  description="Interactive API testing"
/>
```

## 🔍 Search & Analytics

The documentation includes:

- **Full-text search** powered by Pagefind
- **Analytics tracking** via Starlight's built-in support
- **Performance monitoring** via Lighthouse CI
- **SEO optimization** with meta tags and structured data

## 🤝 Contributing

To contribute to the documentation:

1. Fork the repository
2. Create a feature branch
3. Make your changes in `src/content/docs/`
4. Test locally with `npx astro dev`
5. Submit a pull request

## 🛠️ Troubleshooting

### Common Issues

**Server won't start:**
- Check Node.js version (18+ required)
- Run `bun install` to ensure dependencies are installed
- Check for port conflicts (default: 4321)

**Styling issues:**
- Clear browser cache
- Check `src/styles/custom.css` for conflicts
- Verify component imports in MDX files

**Build failures:**
- Run `npx astro check` to identify TypeScript issues
- Check MDX syntax in content files
- Verify all component imports are correct

### Support

- **Documentation Issues**: Open an issue on GitHub
- **Feature Requests**: Discuss in GitHub discussions
- **Community**: Join the NUBI Discord server

---

**Built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build) 🌟**