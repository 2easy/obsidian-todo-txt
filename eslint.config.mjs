import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

// Mirrors the Obsidian plugin-review linter: typescript-eslint's
// type-checked rules plus the official obsidianmd plugin.
export default tseslint.config(
	{ ignores: ["main.js", "node_modules/**", "*.mjs"] },
	...tseslint.configs.recommendedTypeChecked,
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	}
);
