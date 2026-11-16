---
title: "How to Format and Validate JSON and Fix Common Syntax Errors"
description: "Pretty-print or minify JSON, find exactly where it breaks, and fix trailing commas, single quotes, unquoted keys and comments."
tool: json-format
related: [json-viewer, json-compare, json-yaml]
updated: 2026-11-16
---

JSON looks forgiving, but the format is strict. A single trailing comma, a pair of single quotes or a `//` comment is enough for an API, a config loader or `JSON.parse` to reject the whole file. The error message often points at a character position on line 1 of a minified blob, which isn't much help. This guide shows how to format and validate JSON with the [JSON Formatter](/tools/json-format/), how to locate the error quickly with the [JSON Viewer](/tools/json-viewer/), and how to recognise the handful of mistakes behind most invalid JSON.

## Format or minify JSON

1. Open the [JSON Formatter](/tools/json-format/) and paste your JSON into **Input JSON**, or click **Load .json file** to open a file from your device.
2. Click **Format (2 spaces)** or **Format (4 spaces)** to pretty-print it, or **Minify** to strip all whitespace into a single line.
3. Read the **Result** panel. Once a mode is selected, the result updates as you keep editing the input, so you can fix errors and see the output immediately.
4. Click **Copy**, or download the result as `formatted.json`. **Clear** empties everything.

Formatting is also validation: the formatter uses the same strict parser that browsers and Node.js use for `JSON.parse`. If the result appears, the JSON is valid. If not, you get a red error message instead.

## Find where the JSON breaks

The formatter's error text comes from your browser's own parser. In Chrome and Edge it looks like `Expected double-quoted property name in JSON at position 7 (line 1 column 8)`; other browsers word it differently. When the message is vague, paste the same text into the [JSON Viewer](/tools/json-viewer/):

1. Paste the JSON into the **Input** box (the **JSON** format button is selected by default).
2. If it can't be read, the viewer shows **Invalid JSON — Line X, column Y** followed by the reason. Go to that line; the real mistake is usually at that spot or just before it.
3. Watch for the note **Read as JSON5 / JSON with comments.** It means the viewer could read your text only by relaxing the rules. In that case your text almost certainly contains one of the four mistakes below, and strict tools will reject it.

## The four mistakes behind most invalid JSON

**1. Trailing commas.** JavaScript allows a comma after the last item; JSON does not.

```
{ "tags": ["a", "b",], "active": true, }
```

Remove the comma before `]` and before `}`. This often happens after deleting the last line of a list.

**2. Single quotes.** JSON strings and keys must use double quotes. `{'name': 'Budi'}` is invalid; `{"name": "Budi"}` is valid. A common source is copying a printed Python dictionary, which also uses `True`, `False` and `None` where JSON needs `true`, `false` and `null`.

**3. Unquoted keys.** `{name: "Budi"}` is a valid JavaScript object but not valid JSON. Every key needs double quotes: `{"name": "Budi"}`.

**4. Comments.** Standard JSON has no comments at all, neither `// ...` nor `/* ... */`. Files such as `tsconfig.json` or VS Code's `settings.json` are really "JSON with comments" (JSONC) and are read by tools that accept it. Send the same file to a strict parser and it fails.

Other errors worth checking: a missing comma between two items (often after you paste a new line), a missing closing `}` or `]`, raw line breaks or tabs inside a string (write them as `\n` and `\t`), and values such as `NaN`, `undefined` or `0x1F`, none of which exist in JSON.

## Convert JSON with comments to strict JSON

If the viewer reads your file as JSON5/JSONC, you can let it do the cleanup:

1. Paste the text into the [JSON Viewer](/tools/json-viewer/) and confirm the tree appears.
2. Hover the top row of the tree (the root) and click its **Copy value** icon.
3. You now have strict, 2-space-indented JSON on your clipboard, with comments removed, keys double-quoted and trailing commas gone. Paste it into the formatter if you want 4 spaces or a minified version.

Keep the original if the comments matter to the people who maintain the file, because they are dropped.

## Pitfalls: when formatting changes your data

Because the formatter parses the JSON and writes it out again, a few things can change silently. These are properties of JavaScript's JSON parser, not bugs in your file:

- **Very large integers lose precision.** Numbers above 9,007,199,254,740,991 can't be stored exactly, so `9007199254740993` comes out as `9007199254740992`. If your data has 64-bit IDs, keep them as strings, or don't run that file through a reformatter before sending it on.
- **Duplicate keys collapse.** `{"x": 1, "x": 2}` becomes `{"x": 2}`. The parser keeps the last one without warning, so formatting is one way to discover duplicates you didn't know about.
- **Numeric-looking keys move to the front.** In `{"name": "a", "10": 1, "2": 2}` the keys `"2"` and `"10"` are printed first, in numeric order. The data means the same, but a diff against the original will show the move.

To check that two versions hold the same data regardless of formatting or key order, use [JSON Deep Compare](/tools/json-compare/).

## Privacy

Parsing and formatting happen in your browser, so API responses, tokens or customer data you paste stay on your device.

## FAQ

### Is valid JSON the same as correct JSON?

No. Valid means the syntax is right. Whether the fields, types and values are what an API expects is a separate question, usually answered by the API's documentation or a JSON Schema.

### Should I use 2 or 4 spaces?

Either is fine; JSON doesn't care. Match whatever your project or team already uses so that diffs stay small. Use **Minify** only for data sent over the network or embedded somewhere size matters.

### Why does my file work in VS Code but fail in my app?

VS Code reads many settings files as JSON with comments, which allows comments and trailing commas. Your app probably uses a strict parser. Remove those features, or convert the file as described above.

### Can the viewer open a file with one JSON object per line?

Yes. The JSON Viewer reads JSON Lines (`.jsonl` or `.ndjson`) as a list of records and reports the line number of a bad record. The formatter expects a single JSON document, so it will reject that format.
