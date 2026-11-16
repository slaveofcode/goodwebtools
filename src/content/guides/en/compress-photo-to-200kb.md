---
title: "How to Compress a Photo to 200 KB for Online Applications"
description: "Get a phone photo or scanned document under a 200 KB or 500 KB upload limit for job, school or government portals, without making it unreadable."
tool: image-compress
related: [image-resize, compress-to-size, image-heic-to-jpg]
updated: 2026-11-16
---

Online application forms for jobs, school registration and government recruitment often reject files above a fixed size, commonly 200 KB for a photo and 500 KB or 1 MB for scanned documents. A photo straight from a modern phone is usually several megabytes, so it gets refused. Lowering the quality alone rarely gets a 12-megapixel photo that small and still looking good. The method that works is to reduce the pixel size first, then compress.

This guide uses the [Image Compressor](/tools/image-compress/) and the [Image Resizer](/tools/image-resize/). Both run in your browser.

## Before you start: check what the portal actually asks for

Read the upload instructions on the portal before you edit anything. Look for three things:

- **Maximum file size.** For example "max 200 KB". Limits differ between institutions and even between fields on the same form, so use the number the portal gives you, not one from another site.
- **Accepted formats.** Many forms accept only JPG/JPEG (sometimes PNG). The compressor can save as WebP, but a form that expects JPG may reject a `.webp` file.
- **Required dimensions or aspect ratio.** Some forms want a fixed size such as a 3:4 portrait. If none is given, choose a size that is still sharp on screen.

## Step 1: Shrink the pixel dimensions

The Image Compressor keeps the original resolution, so do this step first if your photo comes from a phone camera.

1. Open the [Image Resizer](/tools/image-resize/) and drop the photo on the box (or paste it with Ctrl/Cmd+V).
2. Leave **Lock aspect ratio** ticked so the photo is not stretched.
3. Type a new **Width**. About 1000–1200 px on the long side is plenty for an ID or profile photo. A scanned A4 page stays readable at around 1200–1600 px wide.
4. Click **Resize**, check the preview, then use the **Download** button.

The resizer keeps your format, so a JPG stays a JPG. It saves at high quality, so the file may still be over the limit. That is expected, and Step 2 fixes it.

## Step 2: Compress to just under the limit

1. Open the [Image Compressor](/tools/image-compress/) and drop in the resized photo.
2. Under **Format**, choose **JPEG** if the portal asks for JPG. Choose **WebP (smaller)** only if WebP is explicitly accepted.
3. Leave **Quality** at the default 75% and click **Compress**.
4. Read the **Result** line. It shows the new size and the percentage saved compared with the original.
5. If the result is still too big, lower the slider by 5–10 points and click **Compress** again. If it is far below the limit, raise the quality to get a sharper image.
6. When the size fits, click the **Download** button below the preview.

The quality slider runs from 10% to 100%. For a face or a document, artefacts usually start to show below about 50–60%. If you have to go that low to fit the limit, go back to Step 1 and make the image smaller instead. A smaller image at good quality looks better than a large image full of blocky artefacts.

## Prefer one step? Use a target size

If you just need a file under a number, the [Compress to Size](/tools/compress-to-size/) tool can do both steps at once. Pick the **200 KB** or **500 KB** preset (or type a custom value), choose **JPEG** as the image output, and click **Compress**. It searches for the highest quality that fits and only reduces the dimensions when quality alone is not enough. If the target cannot be reached, it says so and gives you the smallest version it could make.

## Tips and pitfalls

- **Leave a safety margin.** The tools count 1 KB as 1,024 bytes, so "200 KB" means 204,800 bytes. A portal that counts 1 KB as 1,000 bytes would see that same file as about 205 KB, over its limit. Aim for about 190 KB when the limit is 200 KB.
- **Transparent PNGs get a white background.** JPEG has no transparency, so the compressor fills transparent areas with white when you choose JPEG. For a cut-out profile photo, that is usually what you want.
- **iPhone HEIC photos.** If a HEIC photo will not open, convert it first with [HEIC to JPG](/tools/image-heic-to-jpg/).
- **Very large images.** If an image is bigger than your browser's canvas limit, the compressor shrinks it automatically and shows a "Scaled down to …" note under the result.
- **Location data is removed.** Re-encoding writes a fresh file, so the EXIF metadata (including GPS location) from your phone is not carried over. This is a good thing for a file you are sending to strangers.
- **Do not compress the same file over and over.** Each JPEG save loses a little more detail. Always start again from the original or the resized file and change the slider, rather than compressing the compressed output.

Your photos are processed in your browser and are not uploaded to GoodWebTools, which matters when the file is an ID card, diploma or family card.

## FAQ

### Why is my photo still over 200 KB at low quality?

The image probably still has too many pixels. A full-resolution phone photo carries a lot of detail even at low quality. Resize it to about 1000–1200 px on the long side first, then compress it.

### Will the portal accept a WebP file?

Only if WebP is listed among the accepted formats. Most application forms list JPG/JPEG and sometimes PNG. Choose **JPEG** in the compressor to be safe.

### Does compressing change the photo's dimensions?

No. The Image Compressor keeps the width and height and only re-encodes the file, unless the image is too large for your browser's canvas limit (it tells you when that happens). To change the dimensions, use the Image Resizer.

### The portal says the file is too big, but the tool shows 199 KB. Why?

The portal may count kilobytes as 1,000 bytes instead of 1,024, so your file looks slightly bigger there. Compress again with a bit more margin, for example to 185–190 KB.

### Can I do this on my phone?

Yes. The tools work in a mobile browser. Tap the drop box to pick a photo from your gallery, then use the download button to save the result.
