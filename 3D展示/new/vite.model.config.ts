import { defineConfig } from 'vite';

/* 仅把「新模型 + 影棚」打成 IIFE 库，供静态叙事页 <script> 直接引入
   输出： ../js/lib/remodel.js（three 一并打进去，保证全局只有一份实例） */
export default defineConfig({
  base: './',
  build: {
    outDir: '../js/lib',
    emptyOutDir: true,
    target: 'es2020',
    minify: 'esbuild',
    assetsInlineLimit: 4 * 1024 * 1024, // backdrop.jpg 内联成 dataURL，避免出现额外资源文件
    lib: {
      entry: 'src/modelEntry.ts',
      name: 'REMODEL',
      formats: ['iife'],
      fileName: () => 'remodel.js',
    },
    chunkSizeWarningLimit: 4096,
  },
});
