---
title: "How to Merge PDF Files Into One Document, in the Right Order"
description: "Combine several PDFs into a single file, put them in the right order, fix individual pages, and keep the merged file small enough to send."
tool: pdf-merge
related: [pdf-organize, pdf-split, pdf-compress]
updated: 2026-11-16
---

Many forms ask for "one PDF containing all supporting documents", but the documents arrive separately: a CV, a cover letter, a scanned diploma, a reference letter, an ID card. Uploading them one by one is not an option, and emailing five attachments looks careless. Merging them puts everything in one file in the order the reader expects.

This guide uses the [Merge PDFs](/tools/pdf-merge/) tool and shows how to deal with the usual problems: wrong page order, unwanted pages, photos that are not PDFs yet, and a merged file that is too big.

## Get the parts ready first

A few minutes of preparation saves redoing the merge:

- **Convert photos and scans to PDF.** The merge tool only accepts PDF files. If your diploma or ID card is a JPG photo, turn it into a PDF with [Images to PDF](/tools/images-to-pdf/) first.
- **Trim each file.** If one document has pages you do not want (a blank back side, an instructions page), extract only the pages you need with [Split PDF](/tools/pdf-split/).
- **Fix sideways pages.** A scan that was saved rotated will stay rotated after the merge. Straighten it first with [Rotate PDF](/tools/pdf-rotate/).
- **Name files in order.** Names like `01-cv.pdf`, `02-cover-letter.pdf` make it easy to check the list before you merge.

## Step-by-step: merge the files

1. Open [Merge PDFs](/tools/pdf-merge/).
2. Drop all the PDFs on the box, or click to browse and select several at once. You can add more files later. Each new batch is added to the end of the list.
3. Check the numbered list. Use the **up** and **down** arrows next to a file to move it, and the **✕** to remove a file you added by mistake.
4. Click the button **Merge N PDFs** (N is the number of files in the list). It needs at least two files.
5. Scroll through the preview and check that each document starts where you expect.
6. Click **Download merged.pdf**, then rename the file to something meaningful, for example `Surname-Application.pdf`.

The order of the list is the order of the final document. All pages of file 1 come first, then all pages of file 2, and so on.

## Rearranging individual pages after merging

The merge tool orders whole files. To move a single page, for instance to put the signed page of a letter right after the cover page, open the merged file in [Organize PDF](/tools/pdf-organize/):

1. Drop `merged.pdf` in. Every page appears as a thumbnail.
2. Drag the thumbnails into the order you want, and click **✕** on any page you want to delete.
3. Optionally tick **Add page numbers** and choose a **Position** and **Start at** value. This is useful when the recipient refers to "page 7 of your application".
4. Click **Apply & download**.

You can also reorder with [Split PDF](/tools/pdf-split/): it extracts pages in exactly the order you type them. For example, `1, 4, 2-3` moves page 4 to second place, and `5-1` reverses a five-page file.

## Keep the merged file small

Merging does not compress anything, so the result is roughly the size of all the parts added together. Three 2 MB scans give you a file of about 6 MB. If that exceeds an upload or email limit, run the merged file through [Compress PDF](/tools/pdf-compress/). If the portal has a strict limit, such as 1 MB, use [Compress to Size](/tools/compress-to-size/). It is often better to compress the large scans first and merge afterwards, so that the small text documents are left as they are.

## Pitfalls to know

- **Bookmarks.** The pages are copied into a new document, so the bookmark (outline) panel of the original files is not carried over.
- **Fillable forms.** Fill in and save any form before merging, because interactive form fields may not keep working in the merged copy.
- **Password-protected files.** A protected PDF may fail to open. Remove the password first with [Unlock PDF](/tools/pdf-unlock/), if you know it.
- **Very large batches.** Everything is processed in your device's memory. Dozens of large scans can be slow on an older phone, so a laptop handles them more comfortably.

The files are combined inside your browser and are not uploaded anywhere, so it is safe for contracts, medical records and identity documents.

## FAQ

### How do I change the order of files before merging?

Use the up and down arrows next to each file in the numbered list. The number on the left is its position in the final PDF.

### Can I merge only some pages of a PDF?

Yes. First extract the pages you want with Split PDF (for example `2-4`), then merge the extracted file with the others.

### Can I add JPG or PNG images to the merge?

Not directly, because the merge tool accepts PDFs only. Convert the images with Images to PDF, then add that PDF to the list.

### Why is the merged PDF so big?

Merging keeps every page exactly as it was, so the sizes add up. Compress the merged file, or compress the largest scans before merging.

### Is there a limit to how many files I can merge?

There is no fixed limit, but you need at least two. Very large batches depend on your device's memory, so if a big merge fails, merge in two rounds and then merge the two results.
