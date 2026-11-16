---
title: "How to Remove an Image Background for Product and Profile Photos"
description: "Cut out a product or portrait with on-device AI, then turn the transparent PNG into a clean white-background JPG that is ready to upload."
tool: image-bg-remove
related: [image-compress, image-crop, pas-foto]
updated: 2026-11-16
---

A cluttered background is the fastest way to make a good product photo look amateur. The same goes for a profile picture taken in a kitchen. Studio lighting and a backdrop help, but for most people the realistic option is to shoot against whatever is there and remove the background afterwards.

The [Background Remover](/tools/image-bg-remove/) does that with an AI model that runs in your browser. This guide covers how to shoot a photo that cuts out cleanly, how to use the tool, and how to turn the transparent result into the white-background JPG that shops and forms usually want.

## Shoot for a clean cut-out

The AI separates the subject from the background by its edges. You get the cleanest result when those edges are easy to see:

- **Contrast.** Put a dark product on a light surface and a light product on a dark one. A white mug on a white table gives the model very little to work with.
- **Space.** Leave some room around the subject and do not crop off part of it. A subject that touches the frame edge, or overlaps other objects, is harder to separate.
- **Even light.** Soft daylight from a window gives clean edges. Harsh shadows can be treated as part of the object.
- **Sharp focus.** A blurry outline gives a blurry cut-out.

Some subjects are hard for any automatic remover: glass and transparent plastic, fine fur, flyaway hair, and thin wires or chains. Expect to check these closely.

## Step-by-step: remove the background

1. Open the [Background Remover](/tools/image-bg-remove/).
2. Drop the photo on the box, click to browse, or paste it with Ctrl/Cmd+V. Processing starts straight away, so there is no extra button to press.
3. The first time, the progress bar shows **Downloading AI model…** while the model (about 40 MB) downloads. It is cached afterwards, so later photos skip this step. Then it shows **Removing background…**.
4. The result is shown on a checkerboard pattern. The checkerboard marks the transparent areas. Zoom into the edges, especially hair, handles and the bottom of the product.
5. Choose what to do with it:
   - **Download PNG** saves a transparent PNG named after your file with `-no-bg` added.
   - **Copy image** puts it on the clipboard so you can paste it into a design app or chat.
   - **Edit in Annotator** opens it in the annotation tool to add arrows, text or highlights.

If the cut-out removes part of the subject or leaves a patch of background, retake the photo with more contrast or a plainer background. There are no manual brush controls, so a better source photo is the fix.

## Turn it into a white-background JPG

A transparent PNG is ideal for designs, slides and layering on other backgrounds. Many listing and application forms, though, expect a JPG, and a photo-sized PNG with transparency is usually a much bigger file than a JPG of the same picture. To make a white-background version:

1. Open the [Image Compressor](/tools/image-compress/) and drop in the `-no-bg.png` file.
2. Under **Format**, choose **JPEG**. JPEG has no transparency, so the compressor fills the transparent areas with plain white.
3. Set **Quality** (75–85% suits product photos), click **Compress**, then download.

You now have a white-background JPG that is usually much smaller than the PNG. If the subject sits off-centre or has too much empty space, frame it with the [Image Cropper](/tools/image-crop/) before compressing.

Need an official ID photo with a red or blue background at 2x3, 3x4 or 4x6 cm? The [Pas Foto Maker](/tools/pas-foto/) removes the background, fills in the colour you choose and lays out a printable sheet.

## Tips for product listings and profiles

- **Keep the original.** Save the uncut photo too. You may want a lifestyle shot later, or you may need to redo the cut-out.
- **Use consistent framing.** For a shop, shoot every product from the same distance and angle, so the white-background images look like a set.
- **Follow the platform's own rules.** Marketplaces and job sites publish their own image guidance (size, ratio, background). Check it rather than assuming.
- **Add a soft shadow later if you want one.** Removing the background also removes the product's natural shadow, so it can look like it is floating. Many sellers like that clean look. If you do not, place the cut-out on a background in a design app and add a shadow there.

The photo and the AI model both stay on your device. Nothing is uploaded, which is useful for unreleased products or personal portraits.

## FAQ

### Why does the first photo take longer?

The first run downloads the AI model, about 40 MB. Your browser then caches it, so the next photos start processing almost immediately, even offline once it has been cached.

### Can I choose a background colour directly?

The Background Remover always outputs a transparent PNG. For white, re-save it as JPEG in the Image Compressor. For red, blue or white ID photos for printing, use the Pas Foto Maker.

### Why are the edges around hair rough?

Fine strands are the hardest part of any cut-out. Shoot against a plain background with good contrast and even light, and avoid backlight that makes hair glow at the edges.

### Why is the PNG so large?

A PNG keeps every pixel of a photo without lossy compression and also stores transparency, so it is usually several times bigger than a JPG. If you do not need transparency, convert it to JPEG as described above.

### Does it work for screenshots, logos or illustrations?

It is designed to find a main subject, such as a person, animal or product. It can work on simple graphics, but logos with thin text or many separate parts may lose pieces. Check the result carefully.
