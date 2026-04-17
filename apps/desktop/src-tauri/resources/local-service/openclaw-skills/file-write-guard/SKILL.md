---
name: file-write-guard
description: Normalize natural-language file creation/writing requests into valid tool arguments. Use when user asks to create/write files (for example “创建一个 xxx.txt”, “new file”, “write content”) to avoid missing write.content errors.
---

# File Write Guard

## Rules

1. If the user asks to create a file but does not provide content, treat it as an empty-file request.
2. For empty-file requests, do not call `write` without content. Use `exec` with `touch <path>`.
3. Use `write` only when content is explicit.
4. For `write`, always include `path`, `content`, and `append`.
5. Keep `content` exact. Do not invent placeholder text.

## Quick Mapping

- "创建一个 312.txt" -> `exec` + `touch 312.txt`
- "创建 312.txt，内容 hello" -> `write` with `{"path":"312.txt","content":"hello","append":false}`
- "追加 world 到 312.txt" -> `write` with `{"path":"312.txt","content":"world","append":true}`
