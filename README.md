# Skill for Skills

Skill for Skills is a local Meta Skill for Codex. It scans compatible local
`SKILL.md` files, matches them to the current task, and returns the smallest
useful ordered route of primary and supporting Skills.

## What it does

- Discovers Skills from Codex, Claude, Cursor, OpenCode, `.agents/skills`, and
  user-approved custom directories.
- Selects a primary Skill and up to two supporting Skills.
- Returns the exact local `SKILL.md` paths so the Agent can load the selected
  instructions.
- Keeps the inventory local and rejects whole-disk or whole-home scans.
- Provides a dependency-free Node.js CLI and a localhost JSON API.

## Install

Replace `<owner>` with the GitHub owner of this repository:

```bash
codex plugin marketplace add hongyulyu714-prog/skill-for-skills
codex plugin add skill-for-skills@skill-for-skills
```

Restart Codex and start a new task after installation.

## Use

Invoke it explicitly:

```text
$skill-for-skills Help me turn this CSV into an Excel report with charts.
```

Or ask Codex to select local Skills:

```text
Find and load the best local Skills for this task.
```

## CLI

```bash
node plugins/skill-for-skills/skills/skill-for-skills/scripts/skill-router.mjs \
  route --task "Create a quarterly presentation"
```

Other commands:

```bash
node plugins/skill-for-skills/skills/skill-for-skills/scripts/skill-router.mjs scan
node plugins/skill-for-skills/skills/skill-for-skills/scripts/skill-router.mjs roots
node plugins/skill-for-skills/skills/skill-for-skills/scripts/skill-router.mjs add-root "/path/to/skills"
node plugins/skill-for-skills/skills/skill-for-skills/scripts/skill-router.mjs serve --port 4319
```

## Privacy and safety

The router reads `SKILL.md` files only from known compatible locations and
directories explicitly added by the user. It does not upload the local
inventory. Routing does not bypass the permissions, setup steps, or safety
requirements of the selected Skills.

## Requirements

- Codex with plugin support
- Node.js 18 or newer

## License

MIT
