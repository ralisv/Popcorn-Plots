import eslintNestJs from "@darraghor/eslint-plugin-nestjs-typed";
import { includeIgnoreFile } from "@eslint/compat";
import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import onlyWarn from "eslint-plugin-only-warn";
import perfectionist from "eslint-plugin-perfectionist";
import react from "eslint-plugin-react";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

export default tseslint.config(
  includeIgnoreFile(gitignorePath),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  eslintNestJs.configs.flatRecommended,
  react.configs.flat["jsx-runtime"],
  perfectionist.configs["recommended-natural"],
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
      reportUnusedInlineConfigs: "warn",
    },
    plugins: { onlyWarn },
    rules: {
      "@darraghor/nestjs-typed/api-method-should-specify-api-response": "off",
      "@darraghor/nestjs-typed/injectable-should-be-provided": "off",
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        {
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
          allowDirectConstAssertionInArrowFunctions: false,
          allowExpressions: true,
          allowIIFEs: true,
        },
      ],
      "@typescript-eslint/no-extraneous-class": [
        "warn",
        {
          allowWithDecorator: true, // for NestJS
        },
      ],
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/restrict-template-expressions": "off",
      "perfectionist/sort-imports": "off", // already handled by prettier
    },
    settings: { react: { version: "19" } },
  },
  eslintConfigPrettier,
);
