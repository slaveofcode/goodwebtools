---
title: "How to Convert a PDF to an Editable Word Document"
description: "Turn a PDF into a .docx you can edit in Word, including scanned pages, and learn what to fix afterwards: tables, columns, headings and hyphens."
tool: pdf-to-docx
related: [image-ocr, pdf-unlock, pdf-extract-images]
updated: 2026-11-16
---

You've been sent a contract, a form or a report as a PDF and need to change a few paragraphs. Retyping it is slow, and copying text out of a PDF usually gives you broken lines that need joining one by one. Converting the PDF to a Word document gives you real paragraphs you can edit, restyle and reuse.

It helps to know one thing first. A PDF doesn't store paragraphs. It stores letters at fixed positions on a page. Any converter has to work out where lines, paragraphs, headings and tables are, so the result is an editable rebuild of the text, not a pixel-perfect copy. This guide shows how to use the [PDF to Word (DOCX)](/tools/pdf-to-docx/) tool and how to tidy up its output quickly.

## Convert the PDF

1. Open [PDF to Word (DOCX)](/tools/pdf-to-docx/).
2. **Decide on OCR before you drop the file.** Conversion starts as soon as a PDF is dropped, and the checkbox is locked while it runs. Leave **Force OCR (scanned PDFs)** unticked for normal PDFs. See the next section for when to tick it.
3. Drop the PDF on the **Drop a PDF** box, or click it to browse. One file is converted at a time.
4. Watch the progress bar. For each page it shows either **Reading text — page 3 of 12…** (the text was taken directly from the PDF) or **Reading (OCR) — page 3 of 12…** (the page was treated as an image and read with OCR). The last step is **Building the Word document…**.
5. The `.docx` downloads automatically with the same name as the PDF, for example `contract.pdf` becomes `contract.docx`.

## Scanned PDFs and when to force OCR

The tool checks every page. If a page has almost no selectable text (fewer than eight real characters), it is treated as a scan. The page is rendered at double resolution and read with on-device OCR. A PDF that mixes typed pages with scanned pages is handled page by page, so you don't need to do anything special.

Tick **Force OCR (scanned PDFs)** when:

- **The scan has a small text layer.** A scanned page with a typed header, a date stamp or a page number added afterwards has some selectable text, so it isn't detected as a scan. Only that small text comes through, and the body is missing.
- **The existing text is garbage.** Some scanners add their own low-quality OCR layer. If copying text from the PDF gives you nonsense, forcing OCR replaces it with a fresh reading.

Don't force OCR on a normal digital PDF. Direct extraction is faster and exact, and it is the only path that rebuilds tables (OCR pages are rebuilt as plain paragraphs). OCR quality depends on the scan. A straight, evenly lit 300 dpi scan reads far better than a phone photo of a crumpled page. The first OCR run also downloads the recognition model once, so it needs an internet connection.

## What you get, and what to fix in Word

The Word file contains editable text only:

- **Headings.** Lines in noticeably larger type become Word's real **Heading 1** or **Heading 2** styles. Turn on **View > Navigation Pane** in Word to see the outline and jump around a long document. If a heading was missed or a large-print line was promoted by mistake, re-apply the style from the Home tab.
- **Paragraphs.** Lines are joined into flowing paragraphs, so you don't get a hard line break at the end of every PDF line.
- **Tables.** Rows whose text lines up in two or more columns become Word tables. Detection is best-effort, so borderless or complex tables may need adjusting.
- **Page breaks.** Every PDF page after the first starts on a new page in Word.

What doesn't come across:

- **Images, logos and signatures** are not included. Pull them out with [Extract Images from PDF](/tools/pdf-extract-images/) and insert them back where needed.
- **Fonts, bold, italics and colours** are not kept. The text uses your Word document's default style, which makes restyling easy.
- **Headers, footers and page numbers** come through as ordinary paragraphs on each page. Delete them, or add a real Word header instead.

Three clean-up jobs come up often:

1. **Two-column layouts turned into a table.** Text set in two columns looks like a two-column grid, so it may arrive as a table. Click inside it and use **Layout > Convert to Text** in Word, then tidy the order.
2. **Leftover hyphens.** A word split at the end of a PDF line, such as "infor-" + "mation", is joined as "infor- mation". Search for a hyphen followed by a space and fix the real splits.
3. **Stray header and footer lines.** A repeated report title or "Page 3 of 12" in the middle of your text came from the PDF's header or footer.

## Before you start: locked PDFs

If the PDF needs a password to open, conversion fails with **Sorry, converting this PDF failed.** Remove the password first with [Unlock PDF](/tools/pdf-unlock/) (you'll need to know the password), then convert the unlocked copy.

The PDF is parsed, OCR'd and turned into a Word file inside your browser, so its contents are not uploaded to a server.

## FAQ

### Will the Word file look exactly like my PDF?

No. You get editable, reflowing text with headings, paragraphs and tables rebuilt, but not the original fonts, images or exact positions.

### Why is my converted document empty or missing most of the text?

The PDF is probably a scan with only a tiny bit of real text on each page, so it wasn't detected as scanned. Tick **Force OCR (scanned PDFs)** before dropping the file again.

### Which languages can the OCR read?

It works best on Latin-script text, such as English, Indonesian and most European languages. Other scripts may be read less accurately.

### Can I convert just one page?

The tool converts the whole PDF. If you only need part of it, extract those pages with [Split PDF](/tools/pdf-split/) first and convert the smaller file. Alternatively, use [Image to Text (OCR)](/tools/image-ocr/), which reads one page at a time and lets you copy the text directly.
