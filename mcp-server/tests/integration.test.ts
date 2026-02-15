import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtemp,
  rm,
  writeFile,
  readFile,
  mkdir,
  stat,
  readdir,
  lstat,
  access,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';

import { ensureDir, getSkillDirectories } from '../src/utils/fs-helpers.js';
import { replacePlaceholders } from '../src/utils/templates.js';
import {
  extractSkillMetadata,
  collectSkillsByScope,
  generateAutoInvokeTable,
  updateAutoInvokeSection,
} from '../src/utils/skills.js';
import { syncSkillSymlinks, ASSISTANT_CONFIG_DIRS } from '../src/utils/symlinks.js';

// ---------------------------------------------------------------------------
// Shared temp directory lifecycle
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'mcp-integration-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check whether a path exists. */
async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copies a directory recursively (simplified version matching the one in tools.ts).
 * This avoids importing private helpers from tools.ts.
 */
async function copyDirRecursive(src: string, dest: string): Promise<string[]> {
  const copied: string[] = [];
  await ensureDir(dest);

  let entries: string[];
  try {
    entries = await readdir(src);
  } catch {
    return copied;
  }

  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const entryStat = await stat(srcPath).catch(() => null);
    if (!entryStat) continue;

    if (entryStat.isDirectory()) {
      const nested = await copyDirRecursive(srcPath, destPath);
      copied.push(...nested);
    } else if (entryStat.isFile()) {
      const { copyFile } = await import('node:fs/promises');
      await copyFile(srcPath, destPath);
      copied.push(destPath);
    }
  }

  return copied;
}

// ===========================================================================
// Integration: setup_project flow
// ===========================================================================

describe('setup_project flow', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tempDir, 'my-project');
    await mkdir(projectDir, { recursive: true });
  });

  it('creates AGENTS.md from template, copies skills, syncs symlinks', async () => {
    // ----- Step 1: Apply template and write AGENTS.md -----
    // We simulate applyTemplate by using replacePlaceholders on a known template string.
    // This mirrors what setup_project does without requiring access to the actual template files.
    const templateContent = [
      '# Repository Guidelines for {project-name}',
      '',
      '## Available Skills',
      '',
      '> **Skills Reference**',
      '> Use these skills for detailed patterns on-demand.',
      '',
      '### Auto-invoke Skills',
      '',
      'When performing these actions, ALWAYS invoke the corresponding skill FIRST:',
      '',
      '| Action | Skill |',
      '|--------|-------|',
      '| {action description} | `{skill-name}` |',
      '',
      '---',
      '',
      '## Project Overview',
      '',
      '{project-name} overview here.',
    ].join('\n');

    const agentsMdContent = replacePlaceholders(templateContent, {
      'project-name': 'test-project',
    });
    const agentsMdPath = join(projectDir, 'AGENTS.md');
    await writeFile(agentsMdPath, agentsMdContent, 'utf-8');

    // ----- Step 2: Copy base skills (simulate with local creation) -----
    // Create skill-creator
    const skillCreatorDir = join(projectDir, 'skills', 'skill-creator');
    await mkdir(skillCreatorDir, { recursive: true });
    await writeFile(
      join(skillCreatorDir, 'SKILL.md'),
      [
        '---',
        'name: skill-creator',
        'description: >',
        '  Creates new AI agent skills.',
        '  Trigger: When creating a new skill.',
        'metadata:',
        '  scope: [root]',
        '  auto_invoke:',
        '    - "Creating new skills"',
        '---',
        '',
        '## Content',
      ].join('\n'),
      'utf-8',
    );
    await mkdir(join(skillCreatorDir, 'assets'), { recursive: true });

    // Create skill-sync
    const skillSyncDir = join(projectDir, 'skills', 'skill-sync');
    await mkdir(skillSyncDir, { recursive: true });
    await writeFile(
      join(skillSyncDir, 'SKILL.md'),
      [
        '---',
        'name: skill-sync',
        'description: >',
        '  Syncs skill metadata to AGENTS.md.',
        '  Trigger: After modifying skills.',
        'metadata:',
        '  scope: [root]',
        '  auto_invoke:',
        '    - "After creating/modifying a skill"',
        '---',
        '',
        '## Content',
      ].join('\n'),
      'utf-8',
    );
    await mkdir(join(skillSyncDir, 'assets'), { recursive: true });

    // ----- Step 3: Sync symlinks -----
    const symlinkAssistants = ['claude', 'gemini', 'codex'];
    const syncResults = await syncSkillSymlinks(projectDir, symlinkAssistants);

    // ----- Verify: AGENTS.md exists -----
    expect(await exists(agentsMdPath)).toBe(true);
    const writtenContent = await readFile(agentsMdPath, 'utf-8');
    expect(writtenContent).toContain('# Repository Guidelines for test-project');

    // ----- Verify: skills/ has skill-creator and skill-sync -----
    const skillDirs = await getSkillDirectories(join(projectDir, 'skills'));
    expect(skillDirs).toContain('skill-creator');
    expect(skillDirs).toContain('skill-sync');

    // ----- Verify: assistant skills directories are symlinks to skills/ -----
    for (const assistant of symlinkAssistants) {
      const linkPath = join(projectDir, ASSISTANT_CONFIG_DIRS[assistant]);
      const linkStat = await lstat(linkPath);
      expect(linkStat.isSymbolicLink()).toBe(true);

      // Verify the symlink resolves to the skills directory
      const resolvedStat = await stat(linkPath);
      expect(resolvedStat.isDirectory()).toBe(true);

      // Skills should be visible through the symlink
      const visibleSkills = await getSkillDirectories(linkPath);
      expect(visibleSkills).toContain('skill-creator');
      expect(visibleSkills).toContain('skill-sync');
    }

    // Verify all three assistants got results
    for (const assistant of symlinkAssistants) {
      expect(syncResults[assistant]).toBeDefined();
      expect(syncResults[assistant].status).toBe('created');
    }
  });
});

// ===========================================================================
// Integration: create_skill flow
// ===========================================================================

describe('create_skill flow', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tempDir, 'project-with-skills');
    await mkdir(join(projectDir, 'skills'), { recursive: true });
  });

  it('creates a new skill with correct frontmatter and syncs symlinks', async () => {
    const skillName = 'testing-skill';
    const description = 'Runs and validates tests';
    const trigger = 'When writing or running tests';
    const scope = ['root', 'src/tests'];
    const autoInvoke = ['Running tests', 'Writing test files'];

    // ----- Step 1: Create SKILL.md with frontmatter (simulate applyTemplate) -----
    const templateContent = [
      '---',
      'name: {skill-name}',
      'description: >',
      '  {Brief description}.',
      '  Trigger: {When}.',
      'metadata:',
      '  author: gentleman-programming',
      '  version: "1.0"',
      '---',
      '',
      '## When to Use',
      '',
      'Use this skill when needed.',
    ].join('\n');

    const appliedContent = replacePlaceholders(templateContent, {
      'skill-name': skillName,
    });

    // Step 2: Parse with gray-matter, modify frontmatter, stringify back
    const parsed = matter(appliedContent);
    parsed.data.name = skillName;
    parsed.data.description = `${description}\nTrigger: ${trigger}`;

    if (!parsed.data.metadata || typeof parsed.data.metadata !== 'object') {
      parsed.data.metadata = {};
    }
    const metadata = parsed.data.metadata as Record<string, unknown>;
    metadata.scope = scope;
    metadata.auto_invoke = autoInvoke;

    const finalContent = matter.stringify(parsed.content, parsed.data);

    // Step 3: Write SKILL.md
    const skillDir = join(projectDir, 'skills', skillName);
    await ensureDir(skillDir);
    await writeFile(join(skillDir, 'SKILL.md'), finalContent, 'utf-8');
    await ensureDir(join(skillDir, 'assets'));

    // ----- Verify: SKILL.md has correct frontmatter -----
    const meta = await extractSkillMetadata(join(skillDir, 'SKILL.md'));
    expect(meta.name).toBe(skillName);
    expect(meta.description).toContain(description);
    expect(meta.description).toContain(`Trigger: ${trigger}`);
    expect(meta.scope).toEqual(scope);
    expect(meta.autoInvoke).toEqual(autoInvoke);

    // ----- Step 4: Sync symlinks -----
    const syncResults = await syncSkillSymlinks(projectDir, ['claude', 'gemini', 'codex']);

    // ----- Verify: symlinks point to skills/ directory -----
    for (const assistant of ['claude', 'gemini', 'codex']) {
      expect(syncResults[assistant].status).toBe('created');
      const linkPath = join(projectDir, ASSISTANT_CONFIG_DIRS[assistant]);
      const linkStat = await lstat(linkPath);
      expect(linkStat.isSymbolicLink()).toBe(true);

      // The skill should be visible through the symlink
      const visibleSkills = await getSkillDirectories(linkPath);
      expect(visibleSkills).toContain(skillName);
    }
  });
});

// ===========================================================================
// Integration: sync_skills flow
// ===========================================================================

describe('sync_skills flow', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tempDir, 'project-sync');
    await mkdir(projectDir, { recursive: true });
  });

  it('collects skills by scope, generates table, updates AGENTS.md', async () => {
    // ----- Setup: Create AGENTS.md with placeholder section -----
    const initialAgentsMd = [
      '# My Project',
      '',
      '> **Skills Reference**',
      '> Use these skills for detailed patterns.',
      '',
      '## Other Content',
      '',
      'Some other content here.',
    ].join('\n');

    await writeFile(join(projectDir, 'AGENTS.md'), initialAgentsMd, 'utf-8');

    // ----- Setup: Create skills with scope and auto_invoke -----
    const skill1Dir = join(projectDir, 'skills', 'linter');
    await mkdir(skill1Dir, { recursive: true });
    await writeFile(
      join(skill1Dir, 'SKILL.md'),
      [
        '---',
        'name: linter',
        'description: >',
        '  Code linting rules.',
        '  Trigger: When writing code.',
        'metadata:',
        '  scope: [root]',
        '  auto_invoke:',
        '    - "Writing code"',
        '    - "Reviewing code"',
        '---',
        '',
        '## Content',
      ].join('\n'),
      'utf-8',
    );

    const skill2Dir = join(projectDir, 'skills', 'formatter');
    await mkdir(skill2Dir, { recursive: true });
    await writeFile(
      join(skill2Dir, 'SKILL.md'),
      [
        '---',
        'name: formatter',
        'description: >',
        '  Code formatting conventions.',
        '  Trigger: When formatting.',
        'metadata:',
        '  scope: [root]',
        '  auto_invoke: "Formatting code"',
        '---',
        '',
        '## Content',
      ].join('\n'),
      'utf-8',
    );

    // A skill scoped to "api" (should not affect root AGENTS.md)
    const skill3Dir = join(projectDir, 'skills', 'api-patterns');
    await mkdir(skill3Dir, { recursive: true });
    await writeFile(
      join(skill3Dir, 'SKILL.md'),
      [
        '---',
        'name: api-patterns',
        'description: >',
        '  API design patterns.',
        '  Trigger: When working on APIs.',
        'metadata:',
        '  scope: [api]',
        '  auto_invoke: "Designing APIs"',
        '---',
        '',
        '## Content',
      ].join('\n'),
      'utf-8',
    );

    // ----- Step 1: Collect skills by scope -----
    const skillsByScope = await collectSkillsByScope(projectDir);

    expect(skillsByScope.has('root')).toBe(true);
    expect(skillsByScope.has('api')).toBe(true);

    const rootSkills = skillsByScope.get('root')!;
    expect(rootSkills.map((s) => s.name).sort()).toEqual(['formatter', 'linter']);

    const apiSkills = skillsByScope.get('api')!;
    expect(apiSkills.map((s) => s.name)).toEqual(['api-patterns']);

    // ----- Step 2: Generate table for root scope -----
    const rootTable = generateAutoInvokeTable(rootSkills);
    expect(rootTable).toContain('### Auto-invoke Skills');
    expect(rootTable).toContain('| Formatting code | `formatter` |');
    expect(rootTable).toContain('| Reviewing code | `linter` |');
    expect(rootTable).toContain('| Writing code | `linter` |');

    // ----- Step 3: Update AGENTS.md -----
    const existingContent = await readFile(join(projectDir, 'AGENTS.md'), 'utf-8');
    const updatedContent = updateAutoInvokeSection(existingContent, rootTable);

    await writeFile(join(projectDir, 'AGENTS.md'), updatedContent, 'utf-8');

    // ----- Verify: AGENTS.md was updated with Auto-invoke table -----
    const finalContent = await readFile(join(projectDir, 'AGENTS.md'), 'utf-8');
    expect(finalContent).toContain('### Auto-invoke Skills');
    expect(finalContent).toContain('| Formatting code | `formatter` |');
    expect(finalContent).toContain('| Reviewing code | `linter` |');
    expect(finalContent).toContain('| Writing code | `linter` |');

    // Original content is preserved
    expect(finalContent).toContain('# My Project');
    expect(finalContent).toContain('## Other Content');
    expect(finalContent).toContain('Some other content here.');

    // ----- Verify: Table is sorted correctly -----
    const formattingIdx = finalContent.indexOf('Formatting code');
    const reviewingIdx = finalContent.indexOf('Reviewing code');
    const writingIdx = finalContent.indexOf('Writing code');
    expect(formattingIdx).toBeLessThan(reviewingIdx);
    expect(reviewingIdx).toBeLessThan(writingIdx);
  });

  it('skips skills without scope or auto_invoke', async () => {
    await writeFile(join(projectDir, 'AGENTS.md'), '# Project\n', 'utf-8');

    // Skill with no metadata at all
    const skillDir = join(projectDir, 'skills', 'bare-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      '---\nname: bare-skill\ndescription: No metadata\n---\n',
      'utf-8',
    );

    const skillsByScope = await collectSkillsByScope(projectDir);
    expect(skillsByScope.size).toBe(0);
  });

  it('handles skills with multiple scopes correctly', async () => {
    await writeFile(join(projectDir, 'AGENTS.md'), '# Project\n', 'utf-8');

    const skillDir = join(projectDir, 'skills', 'cross-scope');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: cross-scope',
        'description: A skill that spans scopes',
        'metadata:',
        '  scope: [root, api, ui]',
        '  auto_invoke: "Cross-cutting action"',
        '---',
      ].join('\n'),
      'utf-8',
    );

    const skillsByScope = await collectSkillsByScope(projectDir);

    // Should appear in all three scopes
    expect(skillsByScope.has('root')).toBe(true);
    expect(skillsByScope.has('api')).toBe(true);
    expect(skillsByScope.has('ui')).toBe(true);

    for (const scope of ['root', 'api', 'ui']) {
      const skills = skillsByScope.get(scope)!;
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('cross-scope');
    }
  });
});

// ===========================================================================
// Integration: Full round-trip (create -> sync -> verify)
// ===========================================================================

describe('full round-trip: create skills, sync table, verify output', () => {
  it('creates skills, syncs auto-invoke table, and updates symlinks in one flow', async () => {
    const projectDir = join(tempDir, 'full-roundtrip');
    await mkdir(projectDir, { recursive: true });

    // Create initial AGENTS.md
    const initialContent = [
      '# Full Round-Trip Project',
      '',
      '> **Skills Reference**',
      '> Skills are loaded on demand.',
      '',
      '## Development',
      '',
      'Project dev notes.',
    ].join('\n');
    await writeFile(join(projectDir, 'AGENTS.md'), initialContent, 'utf-8');

    // Create two skills
    for (const [name, action] of [
      ['deployer', 'Deploying applications'],
      ['reviewer', 'Code review'],
    ] as const) {
      const dir = join(projectDir, 'skills', name);
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, 'SKILL.md'),
        [
          '---',
          `name: ${name}`,
          `description: Handles ${action.toLowerCase()}`,
          'metadata:',
          '  scope: [root]',
          `  auto_invoke: "${action}"`,
          '---',
          '',
          '## Instructions',
          '',
          `Do ${action.toLowerCase()}.`,
        ].join('\n'),
        'utf-8',
      );
    }

    // Collect, generate, update
    const skillsByScope = await collectSkillsByScope(projectDir);
    const rootSkills = skillsByScope.get('root')!;
    expect(rootSkills).toHaveLength(2);

    const table = generateAutoInvokeTable(rootSkills);
    const existingContent = await readFile(join(projectDir, 'AGENTS.md'), 'utf-8');
    const updatedContent = updateAutoInvokeSection(existingContent, table);
    await writeFile(join(projectDir, 'AGENTS.md'), updatedContent, 'utf-8');

    // Sync symlinks
    const syncResults = await syncSkillSymlinks(projectDir, ['claude', 'gemini', 'codex']);

    // ------ Verify AGENTS.md ------
    const finalMd = await readFile(join(projectDir, 'AGENTS.md'), 'utf-8');
    expect(finalMd).toContain('# Full Round-Trip Project');
    expect(finalMd).toContain('### Auto-invoke Skills');
    // "Code review" sorts before "Deploying applications"
    expect(finalMd).toContain('| Code review | `reviewer` |');
    expect(finalMd).toContain('| Deploying applications | `deployer` |');
    const codeReviewIdx = finalMd.indexOf('Code review');
    const deployIdx = finalMd.indexOf('Deploying applications');
    expect(codeReviewIdx).toBeLessThan(deployIdx);
    // Original content preserved
    expect(finalMd).toContain('## Development');
    expect(finalMd).toContain('Project dev notes.');

    // ------ Verify symlinks ------
    for (const assistant of ['claude', 'gemini', 'codex']) {
      expect(syncResults[assistant].status).toBe('created');
      const linkPath = join(projectDir, ASSISTANT_CONFIG_DIRS[assistant]);
      const linkStat = await lstat(linkPath);
      expect(linkStat.isSymbolicLink()).toBe(true);

      // Symlink resolves to the skills directory
      const resolved = await stat(linkPath);
      expect(resolved.isDirectory()).toBe(true);

      // Both skills should be visible through the symlink
      const visibleSkills = await getSkillDirectories(linkPath);
      expect(visibleSkills).toContain('deployer');
      expect(visibleSkills).toContain('reviewer');
    }
  });
});
