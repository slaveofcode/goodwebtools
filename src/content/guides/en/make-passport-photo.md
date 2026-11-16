---
title: "How to Make a Pas Foto (ID Photo) in 2x3, 3x4 or 4x6 to Print"
description: "Make a print-ready Indonesian pas foto at home: red or blue background, 2x3, 3x4 or 4x6 cm, laid out on 4R or A4 paper and printed at true size."
tool: pas-foto
related: [image-bg-remove, image-crop, compress-to-size]
updated: 2026-11-16
---

In Indonesia, a "pas foto" is asked for almost everywhere: school and university registration, job applications, civil-service and licence paperwork, membership cards. The usual sizes are 2x3, 3x4 and 4x6 cm, often on a red or blue background. Getting them done at a photo studio is simple, but if you need a set tonight, or need a different background colour than last time, you can make the photo yourself and only pay for the print. This guide walks through the [Pas Foto Maker](/tools/pas-foto/) and the details that decide whether the print comes out the right size.

## Before you start: get the requirements

Requirements differ between institutions and can change from one intake to the next. Before making anything, check the official announcement for:

- the **size** (2x3, 3x4 or 4x6 cm),
- the **background colour** (red, blue, white or a specific shade),
- **how many copies** and whether prints or a digital file are wanted,
- any rules on clothing, glasses or head covering.

If the announcement says nothing about the background, ask the institution instead of guessing.

## Step 1: take or upload the photo

1. Open the [Pas Foto Maker](/tools/pas-foto/).
2. Choose **Upload a photo** and drop, browse for or paste a portrait, or choose **Take a photo** to use your camera.
3. With the camera, the front camera opens with a head-shaped oval. Follow the prompts (**Move a little closer**, **Center your head in the oval** and so on) until it shows **Framing looks good — hold still**. With **Auto-capture when framed** ticked, it counts down from 3 and takes the picture; otherwise press **Capture**. **Switch camera** changes cameras, and **Use device camera** opens your phone's own camera app.

For a better photo: face a window or another soft, even light; keep the background behind you plain and uncluttered; look straight at the lens with your shoulders level. A selfie at arm's length makes the nose look larger than it is, so if you can, have someone else take the picture from a couple of metres away using the rear camera, and zoom in slightly.

## Step 2: background colour

1. Leave **Remove background** ticked. The first time, the tool shows **Downloading model…**, then **Removing background…**. This runs on your device and can take a little while on a slow phone.
2. Under **Background color**, click the red, blue or white swatch, or use the colour picker next to them for an exact shade if the institution specifies one.
3. Check the hair edges in the preview. If wisps look cut off or patches of the old background remain, retake the photo against a plainer background with better light. You can also untick **Remove background** to keep the original background, for example if you already photographed yourself against a red wall.

## Step 3: size and framing

1. Under **Photo size**, choose **2×3 cm**, **3×4 cm** or **4×6 cm** (3×4 is selected first).
2. After a photo loads, the tool detects your face and sets the **Zoom** and **Vertical position** sliders so your head fits the guide.
3. With **Show framing guide** on, the dashed lines mark the top of the head and the chin. Fine-tune with the sliders until your crown and chin sit on them.
4. **Important:** if you change the photo size after the photo is loaded, click **Auto-align head** again. The previous alignment was calculated for the old size, and the head can end up too high or too tight in the new one.

The guide follows the common passport-style proportion, where the head fills most of the frame. If an institution specifies a different head size, adjust **Zoom** to match.

## Step 4: lay out and print

1. Under **Print sheet**, choose **4R (10×15 cm)** for photo paper or **A4 (21×29.7 cm)** for a regular printer. The line below tells you how many copies fit:

| Photo size | 4R sheet | A4 sheet |
| --- | --- | --- |
| 2x3 cm | 16 | 81 |
| 3x4 cm | 9 | 36 |
| 4x6 cm | 4 | 16 |

2. Click **Generate print PDF**, check the preview, and download the PDF (for example `pas-foto-3x4-4r.pdf`).
3. Print at **100% / Actual size**. Turn off "Fit to page", "Shrink to fit" or "Borderless", which all rescale the page, so a 3x4 photo no longer measures 3x4 cm.
4. Measure one photo with a ruler before cutting. Then cut along the thin grey borders; there is a 2 mm gap between photos.

Each photo is rendered at 300 DPI (a 3x4 photo is 354 × 472 pixels), which prints sharply on a home inkjet or at a photo kiosk. To print at a copy or photo shop, bring the PDF on your phone or a flash drive and ask them to print it "actual size, no scaling".

## Privacy

Background removal and face detection run in your browser with on-device models, so your face photo is never uploaded.

## FAQ

### Red or blue: which background should I use?

It depends on the institution and sometimes on the purpose, and there is no single national rule for every document. Follow the announcement you're applying to. If it's silent, ask them. Making both versions costs nothing, so you could print one sheet of each.

### Can I use this for a visa or a foreign passport?

Only if that country asks for 2x3, 3x4 or 4x6 cm. Many visa photos use other sizes, such as 35×45 mm or 2×2 inches, which this tool doesn't offer.

### The online form wants a JPG under 200 KB. Does this work?

This tool produces a print PDF, not a single digital photo. For an upload, prepare the image with [Background Remover](/tools/image-bg-remove/) and [Image Cropper](/tools/image-crop/), then reduce it with [Compress to Size](/tools/compress-to-size/), following the form's pixel and file-size limits.

### Why did my printed photo come out smaller than 3x4 cm?

The printer scaled the page. Reprint with the scale set to 100% or "Actual size", and make sure the paper size in the print dialog matches the sheet you chose (4R or A4).
