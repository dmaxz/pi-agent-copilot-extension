---
type: Guide
title: Platform Notes
description: Platform-specific notes for Windows, tmux, Termux, and Docker.
tags: [platform, windows, tmux, docker]
timestamp: 2026-07-07T00:00:00Z
---

**Node.js 22+ required.** `undici@8.5.0` crashes on Node 20.

# Windows

- `Alt+Enter` doesn't insert newline — use `Ctrl+Enter`
- UTF-8 BOM in config causes HTTP 400
- Forward slashes work: `C:/Users/...`

# tmux

```bash
tmux new-session -d -s agent1 -x 120 -y 40 'pi'
tmux send-keys -t agent1 'Build REST API' Enter
tmux capture-pane -t agent1 -p
```

See: [Quickstart](/guides/quickstart.md)
