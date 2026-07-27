---
name: skill-for-skills
description: Automatically discover, rank, and load the best local Agent Skills for the current task. Use before starting a task when several local Skills may apply, when the correct Skill is unclear, when the user asks which Skill to use, or when the user asks to route, select, find, or orchestrate installed Skills. Supports Codex, Claude, Cursor, OpenCode, .agents/skills, environment-provided paths, and user-approved custom directories.
---

# Skill for Skills

Route the user's task to the smallest useful ordered set of local Skills, then
load those Skill instructions before doing the work.

## Route the task

1. Preserve the user's task text and intent.
2. Run the bundled router:

   ```bash
   node "<this-skill-directory>/scripts/skill-router.mjs" route --task "<user task>"
   ```

3. Read the JSON result. Treat `selected` as an ordered route, not a list of
   optional recommendations.
4. For every selected item, in order:
   - If the Skill is already exposed by the current Agent host, invoke it by its
     exposed name.
   - Otherwise, read the returned `filePath` completely and follow its
     instructions as the selected local Skill.
5. Execute the user's task using the selected Skills. Do not stop after merely
   reporting the route unless the user only asked for a recommendation.

Never recursively route `skill-for-skills` through itself.

## Interpret the result

- `主 Skill` owns the main workflow and output.
- `辅助 Skill` supplies a distinct missing capability such as browser control
  or document rendering.
- Use no more than three Skills unless the task clearly requires more and the
  user approves the expansion.
- Prefer one Skill that fully covers the task over several overlapping Skills.
- Respect setup, login, safety, and approval requirements in every loaded
  Skill. Routing never grants extra permission.
- If confidence is `low`, briefly tell the user which Skill was chosen and why
  before beginning a high-impact action.
- If no useful Skill is found, continue with normal Agent capabilities and say
  that no matching local Skill was available only when that fact matters.

## Manage local sources

The router automatically checks common compatible locations and reads only
`SKILL.md` files. It does not scan the whole disk and does not upload the Skill
inventory.

Use these commands only when needed:

```bash
# Show discovered roots
node "<this-skill-directory>/scripts/skill-router.mjs" roots

# Add a user-approved Skill directory
node "<this-skill-directory>/scripts/skill-router.mjs" add-root "/path/to/skills"

# Remove a custom directory
node "<this-skill-directory>/scripts/skill-router.mjs" remove-root "/path/to/skills"

# Start the localhost API used by a future browser extension
node "<this-skill-directory>/scripts/skill-router.mjs" serve --port 4319
```

Do not add a directory unless the user supplied or approved it. Reject the
filesystem root and the entire home directory.
