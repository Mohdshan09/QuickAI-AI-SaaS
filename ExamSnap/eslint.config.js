import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";

export default [
  { ignores: ["dist", "dev-dist", "node_modules"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    plugins: { react },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.worker },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Count identifiers referenced in JSX as "used" (new JSX transform needs no React import).
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Node runtime: build scripts, the migration runner and the serverless API functions.
    files: ["scripts/**/*.{js,mjs}", "api/**/*.js", "**/*.test.{js,jsx}"],
    languageOptions: { globals: { ...globals.node } },
  },
];
