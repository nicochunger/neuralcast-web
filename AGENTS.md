# Agent instructions

## Git workflow

- The repository remotes are already configured with credentials suitable for normal Git operations.
- Use simple Git commands for repository work: inspect with `git status` and `git diff`, then use `git add`, `git commit`, and `git push` as requested.
- Do not require GitHub CLI authentication or introduce a branch/PR workflow unless the user explicitly asks for it.
- Stage only the files belonging to the requested change; leave unrelated worktree changes untouched.
