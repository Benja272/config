import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { ASSETS_ROOT } from "./utils/fs-helpers.js";

export function registerPrompts(server: McpServer): void {
  server.prompt(
    "generate-project-config",
    "Multi-phase orchestration prompt for generating comprehensive AI agent configs for a project. Guides through: project analysis, root AGENTS.md generation, component configs, optional skill creation, validation, and setup.",
    {
      project_path: z
        .string()
        .describe("Absolute path to the project to configure"),
      focus: z
        .string()
        .optional()
        .describe(
          "Optional focus area (e.g., 'API component', 'testing patterns')"
        ),
      skip_phases: z
        .string()
        .optional()
        .describe(
          "Comma-separated phases to skip (e.g., '4,6' to skip skill generation and setup)"
        ),
    },
    async ({ project_path, focus, skip_phases }) => {
      const orchestrationPath = join(
        ASSETS_ROOT,
        "orchestration",
        "generate-project-config.md"
      );

      let content = await readFile(orchestrationPath, "utf-8");

      content = content.replaceAll("{project_path}", project_path);

      if (focus) {
        content += `\n\n## Focus Area\nFocus on: ${focus}`;
      }

      if (skip_phases) {
        content += `\n\n## Phases to Skip\nSkip phases: ${skip_phases}`;
      }

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: content,
            },
          },
        ],
      };
    }
  );
}
