# Lloom Workshop

A Claude Code plugin marketplace of content-only packs: skills, agents, slash commands, output
styles, themes and session guidance for [Lloom](https://lloom.app). A pack is plain text. Each one
is added by pull request and checked by a script in CI before it is merged. Lloom shows this
marketplace on its Plugins page, and plain Claude Code can add it too.

[![check-packs](https://github.com/sevenevesai/lloom-workshop/actions/workflows/check.yml/badge.svg?branch=main)](https://github.com/sevenevesai/lloom-workshop/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/github/license/sevenevesai/lloom-workshop)](LICENSE)

## Packs

| Pack | What it holds | Needs | Install |
|---|---|---|---|
| [`git-writing`](plugins/git-writing) | Skills `pr-description` and `release-notes`: draft a pull request description or release notes from git history. | A git repository to read | `claude plugin install git-writing@lloom-workshop` |
| [`working-habits`](plugins/working-habits) | Session guidance `handoff-summary`, `commit-discipline` and `test-first-fixes`. | Lloom: Claude Code ignores the `lloom/` folder | `claude plugin install working-habits@lloom-workshop` |

The install lines work once the marketplace is added; see below.

## Install

### In Lloom

1. Open the **Plugins** page and pick the account.
2. On the **Discover** tab, the Lloom Workshop card has an **Add** button. It registers the
   marketplace through Claude Code's own `claude plugin marketplace add`.
3. Each pack's card lists what it contains. Open one to see the full list, then **Install**.

Lloom checks a pack against the same content-only policy before it installs or updates it, and
refuses one that fails.

Installing a pack never changes what a session is told. Guidance a pack offers is listed under
Session Guidance → **From packs**: you read each text and adopt the ones you want. When a pack
update changes a guidance text, you review it again before it replaces the text you adopted.

### In Claude Code

```
claude plugin marketplace add sevenevesai/lloom-workshop
claude plugin install git-writing@lloom-workshop
```

In a session, `/plugin marketplace add sevenevesai/lloom-workshop` registers the marketplace and
`/plugin install git-writing@lloom-workshop` opens the pack's details so you can choose a scope.
To add the marketplace and install in one step, use
`claude plugin install git-writing --marketplace sevenevesai/lloom-workshop` (Claude Code v2.1.292
or later) or `/plugin install git-writing --marketplace sevenevesai/lloom-workshop` in a session
(v2.1.275 or later). Details: Claude Code's
[install and manage plugins](https://code.claude.com/docs/en/discover-plugins.md) page.

Skills, agents and commands from a pack run with the permissions of your Claude Code session.
Read a pack's files before you install it; they are short.

## What "content only" means

A pack may hold `.claude-plugin/`, `skills/`, `agents/`, `commands/`, `output-styles/`,
`themes/`, `lloom/`, `README.md` and `LICENSE`, and only `.md`, `.json`, `.txt`, `.yml` and
`.yaml` files. Hooks, MCP servers, language servers, monitors, workflows, `bin/` and scripts are
refused today. Code mods (hooks and MCP servers) are planned for a later stage and are not
accepted yet.

- `scripts/check-packs.mjs` enforces the rules. Run `node scripts/check-packs.mjs` from the
  repository root: it prints one line per violation, then a summary such as
  `2 packs checked, 0 violations`, and exits 1 when there is a violation.
- [`check.yml`](.github/workflows/check.yml) runs it on every pull request and on pushes to `main`,
  with read-only permissions. A pull request is judged by the base branch's copy of the script, so
  a change cannot weaken the check that judges it.
- [`CODEOWNERS`](.github/CODEOWNERS) names the owner for `scripts/`, `.github/` and
  `.claude-plugin/marketplace.json`.

The full rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Publish a pack

1. Add `plugins/<name>/` with a `.claude-plugin/plugin.json` and the folders you need.
2. Add an entry to `.claude-plugin/marketplace.json`.
3. Run `node scripts/check-packs.mjs` and `claude plugin validate .`.
4. Open a pull request that says what the pack is for.

Lloom can write the pack folder for you: in its Library, **Export as plugin** turns your own
skills, agents, commands, output styles and guidance into a folder ready for a pull request.
[CONTRIBUTING.md](CONTRIBUTING.md) has the layout, the guidance file format, what review looks
at and how to version a pack.

## Layout

```
.claude-plugin/marketplace.json   the catalogue: one entry per pack
plugins/<name>/                   one folder per pack
scripts/check-packs.mjs           the content-only check
scripts/policy-fixture.json       shared test cases for the check (--self-test)
.github/workflows/check.yml       runs the check in CI
```

## Licence

[MIT](LICENSE). Contributions are accepted under the same licence.
