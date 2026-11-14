---
name: release-notes
description: Drafts release notes from the commits since the last tag, written for the people who use the software. Use when asked for release notes, a changelog entry or what changed since a version.
---

# Release notes

1. Find the range: from the most recent tag (`git describe --tags --abbrev=0`) to `HEAD`, unless the user gave another.
2. List its commits: `git log --no-merges --format="%h %s" <tag>..HEAD`. Read a commit's body or diff when its subject does not say what changed for users.
3. Put each change in one group: **Breaking**, **New**, **Improved**, **Fixed** or **Removed**. Leave out refactors, tests, CI and dependency bumps unless they change behaviour.
4. Rewrite each item for users: what they can now do, or what no longer goes wrong, in one sentence. Keep commit hashes out of the text.
5. Put **Breaking** first when it has items, with what users must change.

Write only what the commits support. If the range is empty or there is no tag, say so instead of
guessing. Show the draft; do not create tags, releases or files unless asked.
