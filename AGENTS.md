# Project Agent Rules

## Auto Review Log
For every user request that is completed, append a short entry to `review.md`.

Each entry should include:
- `Date`: current local date/time
- `Question`: 1-2 sentence summary of the user problem/request
- `Solution`: 1-3 sentence summary of what was changed or answered

Format example:

```md
## 2026-03-25 22:30
- Question: ...
- Solution: ...
```

Rules:
- Keep entries concise and factual.
- Append new entries to the end of the file.
- Do not rewrite or delete previous entries unless the user explicitly asks.
- If no file/code changes were made, still record the advice/analysis result.
