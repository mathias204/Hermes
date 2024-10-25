import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['node_modules'],
    coverage: {
      provider: 'istanbul', // Default was v8, but had difficulties with newest version not ignoring types for coverage report
      reporter: ['cobertura', 'text', 'html'],
      exclude: [
        'src/main/playground',
        'src/main/chat-client/chat-client-script.mts',
        'src/main/chat-client/tui.mts',
        'src/main/chat-client/authentication-tui.mts',
        'src/main/chat-server/chat-server-script.mts',
      ],
    },
  },
});
