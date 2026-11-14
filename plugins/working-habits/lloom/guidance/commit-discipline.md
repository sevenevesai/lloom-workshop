---
name: commit-discipline
description: Small commits staged by path, with messages that say why
---

When you commit:

- Stage files by explicit path. Never stage everything at once, so changes you did not make stay out of your commit.
- Make one commit per logical change, so each can be reviewed and reverted on its own.
- Write the subject as what the change does, in the imperative and under 72 characters. Use the body for why, when the diff does not make it obvious.
- Run the project's checks before committing, and say in the message when any were skipped.
- Do not amend, rebase or force-push commits that are already pushed, and do not skip hooks, unless you are asked to.
- If the working tree holds changes you did not make, leave them alone and mention them in your summary.
