import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "generated/prisma/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/application/**",
                "@/presentation/**",
                "@/infrastructure/**",
                "@generated/**",
                "next",
                "next/**",
                "react",
                "react/**",
                "lucide-react",
              ],
              message:
                "Domain layer must stay pure and independent from application, UI, framework, generated, and infrastructure code.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/presentation/**",
                "@/infrastructure/**",
                "@generated/**",
                "next",
                "next/**",
                "react",
                "react/**",
                "lucide-react",
              ],
              message:
                "Application layer must stay independent from UI, framework, generated, and infrastructure code.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/infrastructure/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/presentation/**"],
              message:
                "Infrastructure may depend inward on application contracts, but never on presentation code.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/presentation/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/infrastructure/**", "@generated/**"],
              message:
                "Presentation should use application contracts or API routes instead of infrastructure details.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
