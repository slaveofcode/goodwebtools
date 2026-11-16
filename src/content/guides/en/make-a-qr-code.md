---
title: "How to Make a QR Code for a Link, Wi-Fi or Contact Card"
description: "Make a QR code for a link, Wi-Fi network or contact, choose the right error correction, and print it at a size that scans reliably."
tool: qr-gen
related: [qr-read, image-qr, qris-decoder]
updated: 2026-11-16
---

A QR code is only useful if it scans on the first try. Most codes that fail do so for boring reasons: the link has a typo, the printed code is too small for the distance, it was placed on a busy background, or someone shrank a low-resolution PNG and it went blurry. This guide shows how to make a code with the [QR Code Generator](/tools/qr-gen/) and how to check it before you print a hundred copies.

## What you can put in a QR code

The generator has a single box labelled **Text or URL**. Whatever you type there is stored in the code exactly as written. There are no separate "Wi-Fi" or "contact" forms; instead, phones recognise a few standard text formats and treat them specially. You can type any of these into the box:

- **A website link**, such as `https://example.com/menu`. Always include `https://` so scanners treat it as a link and not plain text.
- **Wi-Fi login**: `WIFI:T:WPA;S:CafeGuest;P:kopi2026;;` where `T` is the security type (`WPA` or `WEP`, or `nopass` for an open network), `S` is the network name and `P` the password. If the name or password contains `;`, `,`, `:`, `\` or `"`, put a backslash in front of that character.
- **A contact card** (vCard). The box accepts several lines, so you can paste:

```
BEGIN:VCARD
VERSION:3.0
FN:Rina Putri
TEL:+6281234567890
EMAIL:rina@example.com
END:VCARD
```

- **Email, phone or SMS shortcuts**: `mailto:hello@example.com`, `tel:+6281234567890` or `sms:+6281234567890`.
- **Plain text**, such as a serial number or a short note.

Most modern phone camera apps offer to join the network or save the contact when they see these formats, but support varies between apps, so always test (see below).

## Steps: create and download the code

1. Open the [QR Code Generator](/tools/qr-gen/) and replace the sample text in **Text or URL** with your own content. The preview updates as you type.
2. Choose an **Error correction** level: **Low (~7%)**, **Medium (~15%)**, **Quartile (~25%)** or **High (~30%)**. The percentage is roughly how much of the code can be damaged or covered while it still decodes.
3. Click **Download** and pick a format. For print, choose **SVG (vector)**; for a website or chat message, **PNG** is fine. JPEG, WebP and (in supporting browsers) AVIF are also offered.
4. Alternatively use **Copy image** to paste the code straight into a document, or **Edit in Annotator** to add a label such as "Scan for the menu".

If you see **Text too long for a QR code**, the content exceeds what a QR code can hold. Shorten it, or host the long content on a page and encode the link instead.

## Choosing the error-correction level

Higher correction adds redundancy, which makes the pattern denser: the same link needs more, smaller squares. That is a trade-off, not a free upgrade.

- **Medium** is the right default for screens and clean indoor print.
- **Quartile or High** helps for stickers on tables, outdoor signs, packaging that gets scuffed, or when you plan to put a small logo over the centre.
- **Low** gives the simplest pattern, which helps when a very long text must still be printed small.

The shorter your content, the coarser the pattern at any level. A short link scans more easily than a long URL with tracking parameters, so strip what you don't need.

## Printing at a size that scans

- **Use the SVG for print.** The PNG preview is rendered at 320 pixels wide. That is sharp on screen, but stretched across a poster it turns blurry. SVG is vector, so it stays crisp at any size.
- **Size for the scanning distance.** A common rule of thumb is that the code's width should be about one tenth of the distance it will be scanned from. A code read from 30 cm away (a table card) works at around 3 cm; a poster read from 2 m needs roughly 20 cm. Bigger is safer; for a dense code, add more.
- **Keep the quiet zone.** Scanners need a blank border around the code. The download includes a thin white margin; if you place it on a coloured or patterned background, leave extra empty space around it rather than cropping into the margin.
- **Keep it dark on light.** Dark squares on a light background scan most reliably. Inverted (light on dark) or low-contrast colour combinations fail on some scanners.
- **Avoid glossy curved surfaces** where glare can wash out part of the pattern.

## Test before you print

1. Scan the code on screen with at least two different phones (ideally one iPhone and one Android) using their built-in camera apps.
2. Print one test copy at the final size and scan it from the real distance and in the real lighting.
3. For a link, check that it opens the right page. For Wi-Fi, check that the phone actually joins the network.
4. Upload a screenshot or photo to the [QR Code Reader](/tools/qr-read/) to see the exact decoded text and spot typos, such as a missing letter in the Wi-Fi password.

## A note about QRIS payments

You can type any text into the generator, but you cannot make your own working QRIS payment code with it. A QRIS code is issued to a registered merchant by a bank or payment provider and carries the merchant's details and a checksum, so print the QRIS that your provider gives you. To check what an existing QRIS contains, such as the merchant name and city, use the [QRIS Decoder](/tools/qris-decoder/).

## Privacy

The code is generated in your browser, so links, Wi-Fi passwords and contact details you type are not sent to a server.

## FAQ

### Do QR codes from this tool expire?

No. The content is stored inside the image itself, so there is no service that can be switched off. The flip side is that you cannot edit it later: if the link changes, you need a new code. If you expect changes, encode a link you control and update where that link points.

### Can I put a logo in the middle?

Yes, but set the error correction to **High (~30%)** first, keep the logo small, and test the result carefully. You can add an image overlay with **Edit in Annotator**. To place a code onto an existing picture, use [Add QR to Image](/tools/image-qr/).

### Why does my Wi-Fi QR code not connect?

Usually it is a typo in the network name or password (both are case-sensitive), the wrong `T:` value, or a special character that wasn't escaped with a backslash. Decode it with the [QR Code Reader](/tools/qr-read/) and compare character by character.
