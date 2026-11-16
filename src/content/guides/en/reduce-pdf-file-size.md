---
title: "How to Reduce PDF File Size Without Losing Readable Text"
description: "Shrink a PDF for email or an upload form: what lossless compression can and cannot do, and what to try when the file is still too big."
tool: pdf-compress
related: [compress-to-size, pdf-split, images-to-pdf]
updated: 2026-11-16
---

A PDF that is too big causes problems: an email bounces, an upload form refuses a CV or scanned certificate, or a shared folder fills up. How much you can shrink it depends on what is inside. A 40-page text report exported from a word processor is often already small. A five-page scan made at high resolution, or a Word file full of phone photos, can be many megabytes.

This guide starts with the [Compress PDF](/tools/pdf-compress/) tool, which keeps the document as it is, and then covers what to do when that is not enough.

## What Compress PDF actually does

The tool re-saves your PDF with the PDF engine's own compression switched on. It compresses page streams, images and fonts that were stored uncompressed, and it removes objects that are no longer used (leftovers from earlier edits, for example). Text stays as real, selectable text, and images are not downsampled.

So it works best on PDFs that were saved inefficiently, and it can do little for a PDF whose images are already compressed JPEGs. If there is nothing to remove, the tool says so instead of returning a worse file.

## Step-by-step: compress a PDF

1. Open [Compress PDF](/tools/pdf-compress/) and drop your file on the box, or click to browse.
2. Check the file name and the original size shown under the box.
3. Click **Compress PDF**. Large files can take a few seconds. The first run also loads the PDF engine.
4. Read the **Result** line: the new size and a percentage such as "−35% smaller".
5. Scroll through the preview to make sure every page looks right.
6. Click **Download compressed.pdf**. Rename the file if the portal or recipient expects a particular name.

If you see **already optimal** and a note that the PDF is "already well-compressed", lossless compression cannot shrink this file any further. Use one of the options below.

## When the file is still too big

### Option 1: Compress to a target size

If you have a hard limit, such as "PDF max 500 KB", use [Compress to Size](/tools/compress-to-size/). Drop the PDF, pick a preset (**200 KB**, **500 KB**, **1 MB**, **2 MB**) or type your own value, and click **Compress**.

It first tries the same lossless compression. If the file is still over the target, it redraws every page as an image at progressively lower resolution and JPEG quality until the file fits. That reaches much smaller sizes, but it has a cost: the tool shows a note that **the text is no longer selectable**. Recipients cannot search or copy text from the result. That is usually fine for a scanned certificate, but not for a CV that a recruiter's system may need to read. Zoom into the preview to make sure small print is still readable.

### Option 2: Remove pages you do not need

A long file often contains pages nobody asked for: blank scans, cover pages, appendices. Use [Split PDF](/tools/pdf-split/) to keep only the pages you need. Type them in **Pages to extract** (for example `1-3, 5`), click **Extract pages**, and download the new file.

### Option 3: Send it in parts

If the recipient accepts several attachments, or the form has separate upload fields, split a large document into chunks with Split PDF (for example `1-10`, then `11-20`) and compress each part.

### Option 4: Rebuild a scan from smaller images

If your PDF is a set of phone photos or scans, it is often better to start again from the images. Shrink them first (around 1200–1600 px wide keeps an A4 page readable), then combine them with [Images to PDF](/tools/images-to-pdf/). This gives you control over resolution, which lossless compression does not.

## Tips and pitfalls

- **Check the limit's units.** Our tools count 1 KB as 1,024 bytes. Some portals count 1,000, so aim a few percent below the stated limit.
- **Compressing twice does nothing.** Running Compress PDF again on its own output removes nothing new.
- **Scan at a sensible resolution next time.** For text documents, a scanner setting of 150–200 DPI in grayscale is usually readable and far smaller than 600 DPI colour.
- **Password-protected files.** If a protected PDF will not open, remove the password first with [Unlock PDF](/tools/pdf-unlock/) (you need to know the password).
- **Keep the original.** Save the compressed copy under a new name, especially after a target-size compression that flattens text.

Your PDF is processed inside your browser and is never uploaded, so this is safe for payslips, contracts and ID scans.

## FAQ

### Why did my PDF barely get smaller?

It was probably already compressed. Most of its size is in JPEG images or embedded fonts that lossless re-saving cannot shrink. To go smaller, you need to lower the image resolution, which Compress to Size does by redrawing pages as images.

### Does Compress PDF reduce quality?

No. It keeps text selectable and does not downsample images. That is also why it cannot shrink every file.

### How do I get a PDF under 1 MB or 500 KB?

Use Compress to Size with the matching preset. If even the smallest version is over the limit, remove unneeded pages with Split PDF or rebuild the scan from smaller images.

### Will the compressed PDF still be searchable?

After Compress PDF, yes. After Compress to Size, only if the lossless step alone was enough. If the tool says pages were flattened to images, the text is no longer selectable or searchable.

### Is there a file size limit?

There is no fixed limit. Very large PDFs depend on your device's memory, so a laptop handles bigger files than an older phone. If a huge file fails, split it into parts first.
