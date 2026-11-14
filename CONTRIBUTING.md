# Contributing a pack

A pack is a Claude Code plugin that holds text only. You add one by opening a pull request that
adds its folder and its marketplace entry.

## Submit a pack

1. Fork this repository and add your pack as `plugins/<name>/`:

   ```
   plugins/my-pack/
   ├── .claude-plugin/plugin.json   name, version, description, author
   ├── skills/<skill>/SKILL.md
   ├── agents/<agent>.md
   ├── commands/<command>.md
   ├── output-styles/<style>.md
   ├── themes/<theme>.json
   ├── lloom/guidance/<name>.md     session guidance for Lloom
   └── README.md                    optional: what it does and how to run it
   ```

   Use only the folders you need. Lloom's **Export as plugin** (in its Library) writes this layout
   from your own config.
2. Add an entry to `.claude-plugin/marketplace.json`:

   ```json
   { "name": "my-pack", "source": "./plugins/my-pack", "description": "One line on what it does." }
   ```

3. Run the checks, both from the repository root:

   ```
   node scripts/check-packs.mjs
   claude plugin validate .
   ```

4. Open a pull request. Say what the pack is for and how you used it.

## Content only, and why

Installing a pack is one click, and what it installs is available to every session of that account. Text
can be read in full before it is merged; code cannot be reviewed to the same standard, and Claude
Code runs a plugin's code as you, with your files and credentials. So for now a pack may hold:

- `.claude-plugin/`, `skills/`, `agents/`, `commands/`, `output-styles/`, `themes/`, `lloom/`,
  `README.md` and `LICENSE`;
- files ending in `.md`, `.json`, `.txt`, `.yml` or `.yaml`, plus `LICENSE`.

It may not hold `hooks/`, `.mcp.json`, `.lsp.json`, `monitors/`, `workflows/`, `bin/`, scripts or
anything else that runs, and its `plugin.json` may not declare hooks, MCP or language servers,
monitors, workflows, channels, user settings or dependencies, or point a component path outside
the pack's own folders. The full list is the table at the top of `scripts/check-packs.mjs`.

Other limits: names use only letters, digits, `.`, `_` and `-`; the folder, `plugin.json` name and
marketplace entry name are the same; no symlinks; each file at most 256 KB, the pack under 2 MB.

The check runs in CI on every pull request, using the copy of `scripts/` on `main`, and Lloom runs
the same check again before it installs a pack. Changes to the rules themselves go through their
own pull request.

Code mods (hooks modules that add panes and commands to Claude Code) and plugin MCP servers are
planned for a later stage, shown with an inspection report before install. They are not accepted
yet.

## Session guidance

A file in `lloom/guidance/` offers one piece of guidance:

```markdown
---
name: tests-first
description: Reproduce a bug with a failing test before fixing it
models: [claude-opus-5-5, claude-sonnet-5-5]
---

The guidance text, as Claude will read it.
```

- `name` is the file name without `.md`. `description` is one line of up to 500 characters.
  `models` is optional; leave it out to offer the guidance to every model Lloom supports.
- The text is at most 4,000 characters. Line breaks and tabs are fine; other control characters
  and bidirectional formatting characters are refused, and the text needs at least one space
  outside double quotes.
- Lloom never sends guidance to a session because a pack was installed. The user reads the text
  and adopts it, and a changed text shows as an update to review, never applied on its own.

## What review looks at

- The checks pass.
- The pack does what its description says, and its names say what it is.
- The text gives Claude instructions a user would agree to: nothing that hides actions from the
  user, sends data anywhere, or overrides the user's own instructions.
- Lines the check prints as `note:` are read closely: a skill or agent that grants tools
  (`allowed-tools`, `tools`), declares hooks, or runs a shell command when it loads (`` !`…` ``)
  needs a reason in the pull request.
- It does not duplicate a pack already here.

## Versioning

Set `version` in `plugin.json` and change it with every update: Claude Code keeps users on the
version they installed until it changes. Use `MAJOR.MINOR.PATCH`, and raise MAJOR when an update
removes or renames something people use. If the marketplace entry also sets `version`, it must
match `plugin.json`.

## Licence

This repository is under the [MIT licence](LICENSE). By opening a pull request you agree that your
contribution is accepted under the same licence.
