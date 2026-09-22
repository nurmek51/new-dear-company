import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'react-native': path.resolve(__dirname, 'tests/stubs/react-native.ts'),
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'tests/stubs/async-storage.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // config.ts reads the API base URL at module load.
    env: { EXPO_PUBLIC_API_BASE_URL: 'https://api.test' },
  },
});
