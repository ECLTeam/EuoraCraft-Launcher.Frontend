export default {
  plugins: {
    // 交给 Vite 统一压缩，避免 Tailwind 再次优化时移除标准 backdrop-filter。
    '@tailwindcss/postcss': { optimize: false },
    autoprefixer: {},
  },
}
