---
title: "How to Extract Text from an Image, Screenshot or Photo"
description: "Copy text out of screenshots, photos of documents and PDF pages with on-device OCR, plus fixes for faint, tilted, long or two-column images."
tool: image-ocr
related: [text-cleanup, scan-deskew, image-crop]
updated: 2026-11-16
---

Text locked inside an image is surprisingly common. Think of a screenshot of an error message, a photo of a printed letter, a scanned page someone sent as a PDF, a slide from a meeting, or an address in a chat screenshot. Retyping it is slow and invites typos. OCR (optical character recognition) reads the letters for you, so you can paste them into an email, a document or a search box.

This guide uses [Image to Text (OCR)](/tools/image-ocr/), which runs the recognition model in your browser. It also covers the adjustments that make the difference between clean text and a mess.

## Extract text in four steps

1. Open [Image to Text (OCR)](/tools/image-ocr/) and give it an image or PDF. There are three ways: drop the file on the box, paste a screenshot straight from the clipboard with ⌘V / Ctrl+V, or click **Use camera** and then **Capture** to photograph a page. If your device has more than one camera, **Switch camera** changes between them.
2. Check the preview. If the image is sideways, click **Rotate 90°** (each click turns it a quarter clockwise) until the text reads normally.
3. Click **Run OCR**. While it works, the button shows **Reading…**. The first time, it also downloads the OCR model, a one-time download of a few megabytes, so that first run needs a connection and takes longer.
4. The result appears in an editable **Recognized text** box. Fix any misread characters right there, then click **Copy**, or **Download .txt** to save it as `ocr.txt`.

For a multi-page PDF, use **Prev** and **Next** to pick a page (the counter shows **Page 2 / 5**, for example), then run OCR on that page. Each page is read separately, so repeat for every page you need. To turn a whole PDF into an editable document in one go, [PDF to Word](/tools/pdf-to-docx/) is the better tool.

## Getting cleaner results

**Crop tightly.** OCR reads everything it sees, including the clock, battery icon and app buttons in a phone screenshot. Crop to just the text you want with the [Image Cropper](/tools/image-crop/) first and you'll have far less to delete afterwards.

**Split long screenshots.** Before reading, the tool scales the image so its longest side is at most 2000 pixels. A normal screenshot is unaffected, but a long scrolling capture of a whole chat or web page gets shrunk until the letters are tiny. Cut it into a few screen-height pieces and read them one at a time.

**Read one column at a time.** The text is assembled top to bottom, left to right, with words on the same horizontal line joined together. On a two-column page, a newspaper or a table, lines from the left and right columns end up merged into one line. Crop each column separately.

**Straighten photos of paper.** A page photographed at an angle has slanted, shrinking lines that read poorly. Run it through [Scan Deskew & Crop](/tools/scan-deskew/) first to flatten the perspective.

**Use Clean up image for faint or shadowy text.** Tick **Clean up image** to turn the picture into pure black and white, and watch the preview as you move the **Threshold** slider (0–255, starting at 140). Pixels darker than the threshold become black, and everything else becomes white.
- Raise the threshold when thin or light grey text breaks up or vanishes.
- Lower it when a grey background, paper texture or shadow turns into black blotches.

You don't need it for clean screenshots, and dark-mode screenshots (light text on dark) usually read fine as they are.

**Expect gaps rather than guesses.** Text the model can't read confidently is left out instead of being filled with random characters. If a word or line is missing, it's usually too small, blurry or low-contrast. Zoom in or crop closer, or use the cleanup option.

## Tidying the text

Each visual line of the image becomes its own line in the result, so a paragraph from a printed page comes out with a line break every few words. Paste the text into [Text Cleanup](/tools/text-cleanup/) and use **Remove line breaks (join)** to merge it back into flowing sentences. Then double-check the characters OCR most often confuses: `0` and `O`, `1`, `l` and `I`, `rn` and `m`, and commas and full stops in numbers. For receipts, tick **Parse as receipt** under the result to pull out fields such as the merchant and totals.

## Languages

The tool works best on printed Latin-script text, which covers English, Indonesian and most European languages. The underlying model also covers other writing systems such as Chinese and Japanese. It is a compact version built for speed, though, so expect less consistent results in those scripts than in Latin text. Handwriting is not reliable. Neat block capitals may work, but cursive usually won't.

Recognition runs on your device. If your browser supports WebGPU it uses that, otherwise it falls back to a slower CPU mode and shows a note saying so. Either way, the image itself is not uploaded.

## FAQ

### Why does it say "No text detected"?

The model found nothing it could read with confidence. Make sure the image is right way up (use **Rotate 90°**), crop closer to the text, and try **Clean up image** with a different threshold. Very small text in a big photo is the most common cause.

### Can it read text from a PDF?

Yes. Drop the PDF, choose the page with **Prev** and **Next**, and click **Run OCR**. This works for scanned PDFs too. For digital PDFs, you can usually select and copy the text directly without OCR.

### Does it work offline?

After the first successful run the model is stored by your browser, so later runs don't need to download it again. The very first run needs an internet connection to fetch the model.

### Why is it slow on my computer?

If WebGPU isn't available in your browser, recognition runs on the CPU, which is noticeably slower, especially for large photos. Cropping to the text you need also reduces the work.
