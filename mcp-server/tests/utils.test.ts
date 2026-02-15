import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir, readlink, stat, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getSkillDirectories } from '../src/utils/fs-helpers.js';
import {
  extractSkillMetadata,
  generateAutoInvokeTable,
  updateAutoInvokeSection,
  type SkillMetadata,
} from '../src/utils/skills.js';
import { replacePlaceholders } from '../src/utils/templates.js';
import { syncSkillSymlinks, ASSISTANT_CONFIG_DIRS } from '../src/utils/symlinks.js';

// ---------------------------------------------------------------------------
// Shared temp directory lifecycle
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'mcp-server-test-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: write a SKILL.md with raw frontmatter string
// ---------------------------------------------------------------------------

async function writeSkillMd(dir: string, frontmatter: string, body = ''): Promise<string> {
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, 'SKILL.md');
  const content = `---\n${frontmatter}\n---\n${body}`;
  await writeFile(filePath, content, 'utf-8');
  return filePath;
}

// ===========================================================================
// extractSkillMetadata
// ===========================================================================

describe('extractSkillMetadata', () => {
  it('extracts name and description from frontmatter', async () => {
    const skillPath = await writeSkillMd(join(tempDir, 'my-skill'), [
      'name: my-skill',
      'description: >',
      '  A test skill for unit tests.',
      '  Trigger: When testing.',
    ].join('\n'));

    const meta = await extractSkillMetadata(skillPath);
    expect(meta.name).toBe('my-skill');
    expect(meta.description).toContain('A test skill for unit tests.');
    expect(meta.description).toContain('Trigger: When testing.');
  });

  it('extracts single-value scope: scope: [ui] -> ["ui"]', async () => {
    const skillPath = await writeSkillMd(join(tempDir, 'scoped-skill'), [
      'name: scoped-skill',
      'description: A skill with single scope',
      'metadata:',
      '  scope: [ui]',
    ].join('\n'));

    const meta = await extractSkillMetadata(skillPath);
    expect(meta.scope).toEqual(['ui']);
  });

  it('extracts multi-value scope: scope: [ui, api] -> ["ui", "api"]', async () => {
    const skillPath = await writeSkillMd(join(tempDir, 'multi-scope'), [
      'name: multi-scope',
      'description: A skill with multiple scopes',
      'metadata:',
      '  scope: [ui, api]',
    ].join('\n'));

    const meta = await extractSkillMetadata(skillPath);
    expect(meta.scope).toEqual(['ui', 'api']);
  });

  it('extracts single-line auto_invoke: auto_invoke: "Testing" -> ["Testing"]', async () => {
    const skillPath = await writeSkillMd(join(tempDir, 'single-invoke'), [
      'name: single-invoke',
      'description: Skill with single auto_invoke',
      'metadata:',
      '  auto_invoke: "Testing"',
    ].join('\n'));

    const meta = await extractSkillMetadata(skillPath);
    expect(meta.autoInvoke).toEqual(['Testing']);
  });

  it('extracts list auto_invoke: auto_invoke: ["A", "B"] -> ["A", "B"]', async () => {
    const skillPath = await writeSkillMd(join(tempDir, 'list-invoke'), [
      'name: list-invoke',
      'description: Skill with list auto_invoke',
      'metadata:',
      '  auto_invoke:',
      '    - "Action A"',
      '    - "Action B"',
    ].join('\n'));

    const meta = await extractSkillMetadata(skillPath);
    expect(meta.autoInvoke).toEqual(['Action A', 'Action B']);
  });

  it('returns empty arrays for missing metadata', async () => {
    const skillPath = await writeSkillMd(join(tempDir, 'bare-skill'), [
      'name: bare-skill',
      'description: Skill with no metadata block',
    ].join('\n'));

    const meta = await extractSkillMetadata(skillPath);
    expect(meta.name).toBe('bare-skill');
    expect(meta.scope).toEqual([]);
    expect(meta.autoInvoke).toEqual([]);
  });

  it('returns empty name and description when fields are missing', async () => {
    const skillPath = await writeSkillMd(join(tempDir, 'empty-skill'), '');

    const meta = await extractSkillMetadata(skillPath);
    expect(meta.name).toBe('');
    expect(meta.description).toBe('');
    expect(meta.scope).toEqual([]);
    expect(meta.autoInvoke).toEqual([]);
  });
});

// ===========================================================================
// generateAutoInvokeTable
// ===========================================================================

describe('generateAutoInvokeTable', () => {
  it('generates correct markdown table', () => {
    const skills: SkillMetadata[] = [
      { name: 'typescript', description: 'TS patterns', scope: ['root'], autoInvoke: ['Writing TypeScript'] },
    ];

    const table = generateAutoInvokeTable(skills);
    expect(table).toContain('### Auto-invoke Skills');
    expect(table).toContain('| Action | Skill |');
    expect(table).toContain('|--------|-------|');
    expect(table).toContain('| Writing TypeScript | `typescript` |');
  });

  it('sorts rows by Action then Skill name', () => {
    const skills: SkillMetadata[] = [
      { name: 'z-skill', description: '', scope: ['root'], autoInvoke: ['Beta action'] },
      { name: 'a-skill', description: '', scope: ['root'], autoInvoke: ['Beta action'] },
      { name: 'mid-skill', description: '', scope: ['root'], autoInvoke: ['Alpha action'] },
    ];

    const table = generateAutoInvokeTable(skills);
    const lines = table.split('\n');
    // Find rows after header (skip header lines)
    const dataRows = lines.filter((line) => line.startsWith('|') && !line.startsWith('| Action') && !line.startsWith('|---'));

    expect(dataRows).toHaveLength(3);
    // Alpha action first, then Beta action a-skill, then Beta action z-skill
    expect(dataRows[0]).toContain('Alpha action');
    expect(dataRows[0]).toContain('mid-skill');
    expect(dataRows[1]).toContain('Beta action');
    expect(dataRows[1]).toContain('a-skill');
    expect(dataRows[2]).toContain('Beta action');
    expect(dataRows[2]).toContain('z-skill');
  });

  it('handles multiple auto_invoke entries per skill (one row per action)', () => {
    const skills: SkillMetadata[] = [
      {
        name: 'multi-action',
        description: 'Skill with multiple triggers',
        scope: ['root'],
        autoInvoke: ['Creating files', 'Modifying files'],
      },
    ];

    const table = generateAutoInvokeTable(skills);
    const dataRows = table.split('\n').filter(
      (line) => line.startsWith('|') && !line.startsWith('| Action') && !line.startsWith('|---'),
    );

    expect(dataRows).toHaveLength(2);
    expect(dataRows[0]).toContain('Creating files');
    expect(dataRows[0]).toContain('multi-action');
    expect(dataRows[1]).toContain('Modifying files');
    expect(dataRows[1]).toContain('multi-action');
  });
});

// ===========================================================================
// updateAutoInvokeSection
// ===========================================================================

describe('updateAutoInvokeSection', () => {
  const newTable = [
    '### Auto-invoke Skills',
    '',
    'When performing these actions, ALWAYS invoke the corresponding skill FIRST:',
    '',
    '| Action | Skill |',
    '|--------|-------|',
    '| Testing | `test-skill` |',
  ].join('\n');

  it('replaces existing ### Auto-invoke Skills section', () => {
    const existing = [
      '# My Project',
      '',
      '### Auto-invoke Skills',
      '',
      '| Action | Skill |',
      '|--------|-------|',
      '| Old action | `old-skill` |',
      '',
      '---',
      '',
      '## Other Section',
    ].join('\n');

    const result = updateAutoInvokeSection(existing, newTable);

    // Should contain the new table
    expect(result).toContain('| Testing | `test-skill` |');
    // Should NOT contain the old table
    expect(result).not.toContain('Old action');
    expect(result).not.toContain('old-skill');
    // Should preserve surrounding content
    expect(result).toContain('# My Project');
    expect(result).toContain('## Other Section');
  });

  it('inserts after > **Skills Reference** blockquote when section does not exist', () => {
    const existing = [
      '# My Project',
      '',
      '> **Skills Reference**',
      '> Use these skills for detailed patterns.',
      '',
      '## Other Section',
    ].join('\n');

    const result = updateAutoInvokeSection(existing, newTable);

    expect(result).toContain('### Auto-invoke Skills');
    expect(result).toContain('| Testing | `test-skill` |');
    // The new table should appear between the blockquote and "## Other Section"
    const tableIdx = result.indexOf('### Auto-invoke Skills');
    const blockquoteIdx = result.indexOf('> **Skills Reference**');
    const otherSectionIdx = result.indexOf('## Other Section');
    expect(tableIdx).toBeGreaterThan(blockquoteIdx);
    expect(tableIdx).toBeLessThan(otherSectionIdx);
  });

  it('appends to end as fallback when neither section nor blockquote exists', () => {
    const existing = [
      '# My Project',
      '',
      '## Just Some Content',
      '',
      'Nothing else here.',
    ].join('\n');

    const result = updateAutoInvokeSection(existing, newTable);

    expect(result).toContain('### Auto-invoke Skills');
    expect(result).toContain('| Testing | `test-skill` |');
    // Table should be at the end
    expect(result).toMatch(/\| Testing \| `test-skill` \|\n$/);
  });
});

// ===========================================================================
// replacePlaceholders
// ===========================================================================

describe('replacePlaceholders', () => {
  it('replaces {key} placeholders', () => {
    const result = replacePlaceholders('Hello {name}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('handles multiple replacements', () => {
    const result = replacePlaceholders(
      '{greeting} {name}, welcome to {place}!',
      { greeting: 'Hello', name: 'Alice', place: 'Wonderland' },
    );
    expect(result).toBe('Hello Alice, welcome to Wonderland!');
  });

  it('replaces multiple occurrences of the same placeholder', () => {
    const result = replacePlaceholders('{x} and {x}', { x: 'A' });
    expect(result).toBe('A and A');
  });

  it('leaves unmatched placeholders alone', () => {
    const result = replacePlaceholders('Hello {name}, your {role} is ready.', { name: 'Bob' });
    expect(result).toBe('Hello Bob, your {role} is ready.');
  });
});

// ===========================================================================
// syncSkillSymlinks (single-directory symlink approach, matching setup.sh)
// ===========================================================================

describe('syncSkillSymlinks', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tempDir, 'project');
    await mkdir(join(projectDir, 'skills'), { recursive: true });
  });

  it('creates a single directory symlink for each assistant', async () => {
    const results = await syncSkillSymlinks(projectDir, ['claude', 'gemini', 'codex']);

    for (const assistant of ['claude', 'gemini', 'codex']) {
      expect(results[assistant]).toBeDefined();
      expect(results[assistant].status).toBe('created');
    }

    // Verify the actual symlink: .claude/skills -> ../../skills
    const claudeLink = join(projectDir, '.claude', 'skills');
    const linkTarget = await readlink(claudeLink);
    expect(linkTarget).toContain('skills');

    // Verify the symlink resolves to the skills directory
    const targetStat = await stat(claudeLink);
    expect(targetStat.isDirectory()).toBe(true);
  });

  it('skips non-symlink assistants (copilot, cursor)', async () => {
    const results = await syncSkillSymlinks(projectDir, ['copilot', 'cursor', 'claude']);

    expect(results['copilot']).toBeUndefined();
    expect(results['cursor']).toBeUndefined();
    expect(results['claude']).toBeDefined();
    expect(results['claude'].status).toBe('created');
  });

  it('reports unchanged on second sync', async () => {
    // First sync - creates
    const first = await syncSkillSymlinks(projectDir, ['claude']);
    expect(first['claude'].status).toBe('created');

    // Second sync - unchanged
    const second = await syncSkillSymlinks(projectDir, ['claude']);
    expect(second['claude'].status).toBe('unchanged');
  });

  it('does not destroy a real directory at the symlink path', async () => {
    // Create a real directory where the symlink would go
    await mkdir(join(projectDir, '.claude', 'skills'), { recursive: true });
    await writeFile(join(projectDir, '.claude', 'skills', 'user-file.txt'), 'important data');

    const results = await syncSkillSymlinks(projectDir, ['claude']);

    // Should skip rather than destroy the real directory
    expect(results['claude'].status).toBe('unchanged');

    // User data should still be there
    const content = await readFile(join(projectDir, '.claude', 'skills', 'user-file.txt'), 'utf-8');
    expect(content).toBe('important data');
  });

  it('handles missing skills directory gracefully', async () => {
    // Remove the skills directory
    await rm(join(projectDir, 'skills'), { recursive: true });

    const results = await syncSkillSymlinks(projectDir, ['claude']);
    // Symlink is still created (it just points to a non-existent target)
    expect(results['claude']).toBeDefined();
    expect(results['claude'].status).toBe('created');
  });
});

// ===========================================================================
// getSkillDirectories
// ===========================================================================

describe('getSkillDirectories', () => {
  it('returns directories containing SKILL.md', async () => {
    const skillsDir = join(tempDir, 'skills');
    await mkdir(join(skillsDir, 'alpha'), { recursive: true });
    await writeFile(join(skillsDir, 'alpha', 'SKILL.md'), '---\nname: alpha\n---\n');
    await mkdir(join(skillsDir, 'beta'), { recursive: true });
    await writeFile(join(skillsDir, 'beta', 'SKILL.md'), '---\nname: beta\n---\n');

    const dirs = await getSkillDirectories(skillsDir);
    expect(dirs).toEqual(['alpha', 'beta']);
  });

  it('ignores directories without SKILL.md', async () => {
    const skillsDir = join(tempDir, 'skills');
    await mkdir(join(skillsDir, 'has-skill'), { recursive: true });
    await writeFile(join(skillsDir, 'has-skill', 'SKILL.md'), '---\nname: has-skill\n---\n');
    await mkdir(join(skillsDir, 'no-skill'), { recursive: true });
    await writeFile(join(skillsDir, 'no-skill', 'README.md'), '# Not a skill');

    const dirs = await getSkillDirectories(skillsDir);
    expect(dirs).toEqual(['has-skill']);
  });

  it('returns sorted array', async () => {
    const skillsDir = join(tempDir, 'skills');
    for (const name of ['zulu', 'alpha', 'mike']) {
      await mkdir(join(skillsDir, name), { recursive: true });
      await writeFile(join(skillsDir, name, 'SKILL.md'), `---\nname: ${name}\n---\n`);
    }

    const dirs = await getSkillDirectories(skillsDir);
    expect(dirs).toEqual(['alpha', 'mike', 'zulu']);
  });

  it('returns empty array for non-existent directory', async () => {
    const dirs = await getSkillDirectories(join(tempDir, 'nonexistent'));
    expect(dirs).toEqual([]);
  });

  it('ignores files (non-directories) in the skills dir', async () => {
    const skillsDir = join(tempDir, 'skills');
    await mkdir(skillsDir, { recursive: true });
    await writeFile(join(skillsDir, 'stray-file.md'), '# Stray');
    await mkdir(join(skillsDir, 'real-skill'), { recursive: true });
    await writeFile(join(skillsDir, 'real-skill', 'SKILL.md'), '---\nname: real-skill\n---\n');

    const dirs = await getSkillDirectories(skillsDir);
    expect(dirs).toEqual(['real-skill']);
  });
});
