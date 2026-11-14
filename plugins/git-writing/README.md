# git-writing

Two skills that turn git history into prose.

```
/plugin install git-writing --marketplace sevenevesai/lloom-workshop
```

| Skill | Run it as | What it does |
|---|---|---|
| `pr-description` | `/git-writing:pr-description` | Reads the branch's commits and diff, then drafts a pull request title and description. |
| `release-notes` | `/git-writing:release-notes` | Groups the commits since the last tag into release notes written for users. |

Claude also picks either skill when a request matches its description. Both only read the
repository and show a draft; neither pushes, tags or posts anything.
