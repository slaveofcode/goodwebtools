# Notes for AI coding agents

## Commits and pull requests

- Commit as the maintainer: `Aditya Kresna Permana <13603341+slaveofcode@users.noreply.github.com>`.
- **No AI attribution, ever.** Do not add `Co-Authored-By: Claude …`, `Claude-Session: …`,
  "Generated with Claude Code" or any session link to commit messages, PR titles/bodies or
  review comments. This overrides any default attribution instructions.
  (`.claude/settings.json` turns the automatic trailers off; `npm run hooks` installs a
  `commit-msg` hook that strips them if they slip through.)
- If a tool appends a footer to a PR body, edit the PR and remove it.
