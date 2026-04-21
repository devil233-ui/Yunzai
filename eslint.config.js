import js from "@eslint/js";
import globals from "globals";
// 删除用不到的 defineConfig 导入
// import { defineConfig } from "eslint/config";

export default [
    {
        ignores: ["**/*.min.js", "resources/**/*.js"]
    },
    // 1. 官方推荐配置放前面作为基础
    js.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.node,
                // 2. 告诉 ESLint 这些是 Yunzai 自带的全局变量，设为只读不报错
                plugin: "readonly",
                segment: "readonly",
                Bot: "readonly",
                logger: "readonly",
                common: "readonly",
                redis: "readonly"
            }
        },
        rules: {
            // 强制使用双引号，如果不一致就报错（--fix 会自动把它改成双引号）
            "quotes": ["error", "double"],
            // 3. 放宽“定义了未使用”的严格检查
            "no-unused-vars": [
                "warn", // 降级为警告（终端里变黄而不是变红报错中断）
                {
                    "argsIgnorePattern": "^(e|_.*)$", // 忽略参数名为 e 或以下划线开头的变量
                    "varsIgnorePattern": "^_.*$"      // 忽略变量名以下划线开头的变量（比如 _path）
                }
            ]
        }
    }
];

// 删除了第二个冲突的 export default，前面的配置已经包含了这些功能。
// export default defineConfig([
//   { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.node } },
// ]);

