---
title: "How to Watermark a Copy of Your ID Card Before Sharing It"
description: "Stamp a purpose and date across a photo of your ID card and cover the fields the recipient doesn't need, so a leaked copy is harder to reuse."
tool: image-watermark
related: [image-annotate, image-crop, image-face-blur]
updated: 2026-11-16
---

Landlords, employers, hotels, online sellers and rental shops often ask for a photo of your ID card, such as an Indonesian KTP, a driving licence or a passport page. Once you send it, you can't control where it goes. A clean, unmarked copy can be saved and reused, for example to register an account in your name. A watermark doesn't make that impossible, but a copy that clearly says who it was for and when is much less useful to anyone else, and easier to recognise as misused.

This guide combines three steps: crop to the card, stamp a watermark that states the purpose, and cover any fields the recipient doesn't need. Everything uses tools that run in your browser.

## Step 1: Crop to the card

A phone photo of a card usually includes the table, your fingers or other papers. Remove them first.

1. Open the [Image Cropper](/tools/image-crop/) and drop the photo.
2. Drag the crop box over the card, using the corners to resize it. Leave a small margin around the card edges.
3. Click **Crop** and download the result.

If the card was photographed at an angle, straighten it first with [Scan Deskew & Crop](/tools/scan-deskew/) so the text lines run level.

## Step 2: Stamp a watermark that says what the copy is for

A good ID watermark answers three questions: **who** the copy is for, **what** it is for, and **when** it was made. For example:

`COPY FOR TENANCY AT JL. MAWAR 12 ONLY - 16/11/2026`

or, for an online purchase:

`VERIFICATION FOR SHOP XYZ ONLY - 16 NOV 2026`

Then:

1. Open [Image Watermark](/tools/image-watermark/) and drop the cropped image. You can also paste it with ⌘V / Ctrl+V.
2. Replace the default text in **Watermark text**. It starts as "© GoodWebTools", so delete that and type your own line. The field is a single line, so keep it short.
3. Under **Layout**, choose **Tiled**. It repeats the text diagonally across the whole card, so cropping out one corner doesn't remove it. **Diagonal** puts a single line through the centre, and **Corner** puts one stamp in the bottom-right, which is easy to cut off. For an ID copy, Tiled is the strongest choice.
4. Lower **Scale**. Text size is measured against the image's shorter side, so a long sentence at the default 30% will be large. Somewhere around 10–20% usually lets each line fit while staying readable.
5. Set **Opacity** so the card underneath stays readable. The slider goes from 10% to 100%. Around 35–50% is usually enough to be obvious without hiding the details the recipient needs to check.
6. Pick a **Color** that contrasts with the card. The default grey can disappear on a light blue or grey card, so a darker colour such as dark red or navy is often easier to see.
7. Click **Add watermark** and look at the preview. If it is too big or too faint, adjust and click **Add watermark** again. Each run starts from your original image, not the previous result, so the watermarks don't pile up.

The download keeps your format: a JPG stays a JPG and a PNG stays a PNG, with "-watermarked" added to the file name.

## Step 3: Cover the fields they don't need

Ask yourself what the recipient actually has to verify. A landlord may only need your name and face. A delivery courier may need nothing beyond your name. Cover everything else, typically your full address, date of birth, signature or part of the ID number, unless you've been told it's required.

You can do this straight from the watermark result:

1. Under the preview, click **Edit in Annotator**. The watermarked image opens in the [Image Annotator](/tools/image-annotate/).
2. For the strongest cover, choose **Pencil**, set **Color** to black, raise **Width** to its maximum, and paint over the field with several overlapping strokes until nothing shows through.
3. **Blur** is quicker (drag a box over the area), but blur is not a guaranteed redaction. Large, high-contrast digits can sometimes still be guessed. Use solid strokes for numbers that matter.
4. Avoid **Highlighter** and **Rectangle** for hiding text. The highlighter is semi-transparent, and the rectangle is only an outline.
5. Click **Download PNG**.

If the face photo on the card isn't needed, for example when you only have to prove your address, run the image through [Face Blur](/tools/image-face-blur/) and pick the **Solid** effect. The tool itself notes that blur and pixelate can be partly reversed, so Solid is the safe option for privacy.

## Tips and pitfalls

- **Watermark first, then cover.** If you cover first and then watermark, the tiled text runs over your black strokes. That's harmless, but it looks messier.
- **Always keep the clean original private.** Make a new watermarked copy for every recipient with their name and the date. If one copy leaks, you'll know where it came from.
- **Check the file size before uploading.** The annotator saves as PNG, which can be several times larger than a JPG of the same photo. If a form has a size limit, compress the final image afterwards.
- **Zoom in on the result** to check that covered fields are fully hidden and the needed details are still readable.
- **Don't watermark a copy you must submit unmarked.** Some official processes require an unaltered scan. If in doubt, ask the organisation before sending a modified copy.

The image is edited on a canvas inside your browser tab, so the ID card photo is not uploaded anywhere while you work on it.

## FAQ

### Will a watermark stop someone from misusing my ID copy?

Not completely. Someone determined could try to edit it out. A tiled watermark that crosses the important fields makes that much harder and makes any misuse easier to spot, especially if the text names the recipient and the date.

### What should I write in the watermark?

State the recipient, the purpose and the date, for example "FOR RENTAL AT ABC MOTOR ONLY - 16/11/2026". Avoid vague text like "COPY", which says nothing about where the copy was supposed to go.

### Is blurring enough to hide my ID number?

Blur may be enough for small text, but it isn't guaranteed. For anything sensitive, cover the area with solid black strokes using the Pencil, or the Solid effect in Face Blur for the photo.
