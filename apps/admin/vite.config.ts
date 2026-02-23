import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3006,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Ant Design + Refine（共享依赖，合并避免循环）
          antd: ['antd', '@ant-design/icons', '@refinedev/core', '@refinedev/antd'],
          // React 核心
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
