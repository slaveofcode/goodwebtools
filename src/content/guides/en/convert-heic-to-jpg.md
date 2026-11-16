---
title: "How to Convert iPhone HEIC Photos to JPG on Windows or the Web"
description: "Turn iPhone .HEIC photos into JPGs that open on Windows and upload to any web form, in batches, with control over quality and file size."
tool: image-heic-to-jpg
related: [image-compress, compress-to-size, image-resize]
updated: 2026-11-16
---

iPhones save photos as HEIC (`.heic`, sometimes `.heif`) by default. It is a compact format, but plenty of software still cannot read it. Copy photos from an iPhone to a Windows laptop by cable, download them from iCloud, or receive them as files in a chat app, and you can end up with a folder of `IMG_1234.HEIC` files. Windows Photos may refuse to open them. Older editors show a blank thumbnail. An upload form that says "JPG or PNG only" rejects them outright.

Converting to JPG fixes all three problems, because JPG opens almost everywhere. This guide uses the [HEIC to JPG](/tools/image-heic-to-jpg/) tool, which decodes the photos inside your browser, so it works on Windows, Linux, a Chromebook or Android without installing anything.

## Convert one photo or a whole folder

1. Open [HEIC to JPG](/tools/image-heic-to-jpg/) and drop your photos on the box that says **Drop HEIC photos or click to browse**. You can select many files at once. Use Ctrl+A in the file picker to take a whole folder.
2. Look at the line under the box. It shows how many files were accepted. Anything that isn't HEIC/HEIF (a stray `.MOV` from a Live Photo, or a JPG that is already converted) is skipped, and the tool tells you how many files were ignored.
3. Set the **JPG quality** slider. It runs from 50% to 100% and starts at 92%, which looks the same as the original on screen.
4. Click **Convert to JPG** (with several files the button reads **Convert 12 photos to JPG**, for example). A progress bar counts through the batch.
5. Each converted photo appears with a preview and its new file size. Download photos one at a time with their **Download** button, or click **Download all as ZIP** to get the whole batch as `heic-to-jpg.zip`.

Each JPG keeps the original name with a new extension, so `IMG_1234.HEIC` becomes `IMG_1234.jpg`. If two files would end up with the same name, the second one becomes `IMG_1234 (2).jpg` so nothing is overwritten inside the ZIP.

If one file is damaged or isn't really HEIC, the tool shows a red **Could not convert …** message for that file and keeps going with the rest. One bad file doesn't stop the batch.

## Choosing the right quality

The result panel shows each JPG's size next to a percentage. A green "smaller" figure means the JPG is lighter than the HEIC. A red "larger" figure means it got heavier. A larger file is normal. HEIC compresses more efficiently than JPG, so at 92% a JPG is often bigger than the photo you started with.

Use that figure to decide:

- **For keeping or printing**, leave the quality at 90–100%. You gain compatibility and lose almost nothing visible.
- **For email or chat**, around 80% usually gives a noticeably smaller file with no obvious loss on a phone or laptop screen.
- **For a form with a strict limit** (for example "maximum 500 KB"), lowering quality alone may not be enough for a 12-megapixel photo. Convert first, then use [Compress to Size](/tools/compress-to-size/) to hit an exact target, or the [Image Resizer](/tools/image-resize/) to reduce the pixel dimensions.

Avoid converting the same photo several times at low quality. Every JPG save throws away a little more detail. Always go back to the original HEIC if you need a different setting.

## Things to know before you delete the originals

**Photo details are not copied over.** The converter decodes the image and saves a fresh JPG, and the embedded EXIF data does not come along. That data includes the date taken, the camera model and, if location was on, the GPS position. This is useful when you're sending a photo to someone and don't want your home location inside the file. It is a drawback if you rely on the "date taken" to sort an archive, because the JPGs will sort by file date instead. If those details matter, keep the HEIC originals.

**Only the still image is converted.** A HEIC file holds one main picture, and that's what you get. The moving part of a Live Photo is a separate `.MOV` file, which the tool ignores.

**Large batches take time.** Photos are decoded one after another on your own device, so keep the tab open until the progress bar finishes.

## Stop the problem at the source

If you regularly move photos to a Windows PC, two iPhone settings help:

- **Settings > Camera > Formats > Most Compatible** makes the camera shoot JPG from then on. The files are larger, and some video recording modes are only available with High Efficiency selected.
- In the **Photos** settings, **Transfer to Mac or PC > Automatic** tells the iPhone to convert photos to a compatible format when you copy them over a cable.

Neither setting touches photos you have already taken, and neither helps when someone sends you HEIC files, so a converter is still handy.

Your photos are decoded by WebAssembly code running inside the browser tab. They are not sent to a server while they are converted.

## FAQ

### Why does Windows say it can't open my HEIC file?

Windows needs extra codec extensions from the Microsoft Store to display HEIC photos, and many PCs don't have them installed. Converting to JPG avoids the need for any extension, and the JPG will also open on older PCs and in other people's software.

### Why is my JPG bigger than the original HEIC?

HEIC stores the same picture in fewer bytes than JPG. At high quality settings the JPG can come out larger. Lower the **JPG quality** slider to around 80%, or run the result through an image compressor, if size matters more than perfect detail.

### Does the converted JPG keep the location where the photo was taken?

No. The JPG is a newly encoded image without the original EXIF metadata, so GPS location, date taken and camera details are not included. Keep the HEIC if you need that information.

### Can I convert JPG back to HEIC?

Not with this tool. It only goes one way, from HEIC/HEIF to JPG. For conversions between JPG, PNG and WebP, use the [Image Converter](/tools/image-convert/).
