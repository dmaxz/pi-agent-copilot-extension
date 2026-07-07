---
type: Concept
title: TUI
description: Terminal UI, theme system, custom components, and keybindings.
tags: [tui, themes, ui, keybindings]
timestamp: 2026-07-07T00:00:00Z
---

# Key Bindings

| Key | Action |
|-----|--------|
| `Ctrl+C` | Cancel |
| `Ctrl+D` | Exit |
| `Ctrl+P` | Model picker |
| `Tab` | Autocomplete |
| `Alt+Enter` | Newline (Windows: `Ctrl+Enter`) |

# UI Methods

```typescript
ctx.ui.select(title, options)
ctx.ui.confirm(title, message)
ctx.ui.input(title, placeholder)
ctx.ui.editor(title, prefill)
ctx.ui.notify(message, type)
ctx.ui.setStatus(key, text)
ctx.ui.setTheme(name)
```

See: [Extensions](/concepts/extensions.md)
