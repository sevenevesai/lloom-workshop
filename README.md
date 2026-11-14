# Lloom Workshop

A Claude Code plugin marketplace of content packs: skills, agents, slash commands, output styles,
themes and session guidance. Every pack is plain text, added by pull request and checked before it
is merged. [Lloom](https://lloom.app) offers it on its Plugins page; plain Claude Code can use it
too.

## Packs

| Pack | What it holds |
|---|---|
| [`git-writing`](plugins/git-writing) | Skills that draft pull request descriptions and release notes from git history. |
| [`working-habits`](plugins/working-habits) | Session guidance for Lloom: handoff summaries, commit discipline, test-first bug fixes. |

## Add it in Lloom

1. Open **Settings → Plugins** and pick the account.
2. On the **Discover** tab, the Lloom Workshop card has an **Add** button. It registers the
   marketplace through Claude Code's own `claude plugin marketplace add`.
3. Each pack's card shows what it contains. Open one to see the full list, then **Install**.

Lloom reads a pack from the marketplace before installing it and refuses one that breaks the
content-only rules. Installing never changes what a session is told: guidance a pack offers is
listed under **Settings → Toolkit → Session Guidance → From packs**, where you read each text and
adopt it if you want it.

## Add it in Claude Code

```
claude plugin marketplace add sevenevesai/lloom-workshop
claude plugin install git-writing@lloom-workshop
```

Inside a session, `/plugin marketplace add sevenevesai/lloom-workshop` does the same. Claude Code
ignores a pack's `lloom/` folder, so guidance packs do nothing outside Lloom.

## Contributing

Packs are added by pull request. [CONTRIBUTING.md](CONTRIBUTING.md) covers the format, the
content-only rules, what review looks at and how to version a pack. Lloom can write a pack for
you: in its Library, **Export as plugin** turns your own skills, agents, commands, output styles
and guidance into a folder ready to submit.
