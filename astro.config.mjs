import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: 'NUBI Documentation',
      description: 'Complete documentation for NUBI - The Symbiotic Essence of Anubis AI Agent',
      logo: {
        src: './src/assets/nubi-logo.svg',
        replacesTitle: true,
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/anubis-chat/nubi',
        },
        {
          icon: 'discord',
          label: 'Discord',
          href: 'https://discord.gg/anubis-chat',
        },
        {
          icon: 'twitter',
          label: 'Twitter',
          href: 'https://twitter.com/anubis_chat',
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', link: '/getting-started/introduction/' },
            { label: 'Quick Start', link: '/getting-started/quick-start/' },
            { label: 'Installation', link: '/getting-started/installation/' },
            { label: 'Configuration', link: '/getting-started/configuration/' },
          ],
        },
        {
          label: 'Architecture',
          items: [
            { label: 'Overview', link: '/architecture/overview/' },
            { label: 'Modular Design', link: '/architecture/modular-design/' },
            { label: 'Service Layer', link: '/architecture/services/' },
            { label: 'ElizaOS Integration', link: '/architecture/elizaos/' },
          ],
        },
        {
          label: 'UX Integration System',
          items: [
            { label: 'Overview', link: '/ux-integration/overview/' },
            { label: 'Socket.IO Setup', link: '/ux-integration/socketio/' },
            { label: 'Two-Layer Processing', link: '/ux-integration/processing/' },
            { label: 'Message Classification', link: '/ux-integration/classification/' },
            { label: 'Security Layer', link: '/ux-integration/security/' },
          ],
        },
        {
          label: 'Database System',
          items: [
            { label: 'Pooler Manager', link: '/database/pooler-manager/' },
            { label: 'Query Routing', link: '/database/query-routing/' },
            { label: 'Memory Service', link: '/database/memory-service/' },
            { label: 'Performance', link: '/database/performance/' },
          ],
        },
        {
          label: 'Telegram Raids',
          items: [
            { label: 'System Overview', link: '/telegram-raids/overview/' },
            { label: 'Raid Coordination', link: '/telegram-raids/coordination/' },
            { label: 'Engagement Verification', link: '/telegram-raids/verification/' },
            { label: 'Leaderboards', link: '/telegram-raids/leaderboards/' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'REST API', link: '/api/rest/' },
            { label: 'WebSocket Events', link: '/api/websocket/' },
            { label: 'Service APIs', link: '/api/services/' },
            { label: 'Plugin System', link: '/api/plugins/' },
          ],
        },
        {
          label: 'Deployment',
          items: [
            { label: 'Production Setup', link: '/deployment/production/' },
            { label: 'Docker', link: '/deployment/docker/' },
            { label: 'Environment Variables', link: '/deployment/environment/' },
            { label: 'Monitoring', link: '/deployment/monitoring/' },
          ],
        },
      ],
      customCss: [
        './src/styles/custom.css',
      ],
      expressiveCode: {
        themes: ['night-owl', 'min-light'],
        styleOverrides: {
          borderRadius: '0.5rem',
        },
      },
      components: {
        // Override default components
        Head: './src/components/Head.astro',
        Hero: './src/components/Hero.astro',
      },
    }),
    react(),
    mdx(),
  ],
  output: 'static',
  build: {
    format: 'directory',
  },
});