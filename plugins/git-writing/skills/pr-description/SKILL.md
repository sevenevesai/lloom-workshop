---
name: pr-description
description: Writes a pull request title and description from the current branch's commits and diff. Use when asked to open, write or describe a pull request.
---

# Pull request description

Write a description a reviewer can act on without reading the whole diff first.

## Gather

1. Find the base branch: the repository's default branch, unless the user named another.
2. Read this branch's commits that are not on the base: `git log --oneline <base>..HEAD`.
3. Read the diff against the merge base: `git diff --stat <base>...HEAD`, then the files that carry the change.
4. Look for a linked issue in the branch name and the commit messages.

## Write

- **Title**: what the change does, in the imperative, under 72 characters.
- **Summary**: two to four sentences on what changed and why, leading with the effect a user or caller sees.
- **Changes**: a short list grouped by area, not by file. Leave out mechanical edits unless they are the point.
- **Testing**: what was run and what it showed. If nothing was run, say so.
- **Notes for reviewers**: risky spots, follow-ups, and anything deliberately left out.

Describe only what the diff shows. Do not invent test results, benchmarks or issue numbers. If the
branch mixes unrelated changes, say so and suggest how to split it.

Show the description to the user. Do not push, open the pull request or post it unless they ask.
