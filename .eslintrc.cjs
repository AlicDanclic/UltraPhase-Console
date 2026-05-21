module.exports = {
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },
  rules: {
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "no-console": "off"
  },
  overrides: [
    {
      files: ["src/main/**/*.js", "src/preload/**/*.js"],
      parserOptions: { sourceType: "commonjs" },
      env: { browser: false }
    },
    {
      files: ["src/renderer/**/*.js"],
      parserOptions: { sourceType: "module" },
      env: { node: false }
    }
  ]
};
