import js from "@eslint/js";
import globals from "globals";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      "react-refresh": reactRefresh
    },
    rules: {
      "no-unused-vars": ["error", { varsIgnorePattern: "^React$" }],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
    }
  },
  {
    files: ["browser-extension/**/*.js"],
    languageOptions: {
      globals: {
        chrome: "readonly"
      }
    }
  }
];
