# working-habits

Three pieces of session guidance for [Lloom](https://lloom.app). Each is a short paragraph Lloom
can add to a session's system prompt, after you have read it and chosen to adopt it.

```
/plugin install working-habits --marketplace sevenevesai/lloom-workshop
```

| Guidance | What it asks of Claude |
|---|---|
| `handoff-summary` | End each task with what changed, what was checked, what is left and where to look. |
| `commit-discipline` | Stage by path, one change per commit, messages that say why, never sweep in others' changes. |
| `test-first-fixes` | Reproduce a bug with a failing test, fix the cause, show the test passing. |

Installing the pack changes nothing by itself. In Lloom, open Settings → Toolkit → Session
Guidance, find the pack under **From packs**, read the text and adopt the entries you want.

Plain Claude Code ignores the `lloom/` folder, so the pack does nothing there.
