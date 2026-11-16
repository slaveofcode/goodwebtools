---
title: "How to Create a Strong Password You Never Have to Reuse"
description: "Generate a strong random password, understand why length beats complexity, when to use a passphrase, and how a password manager ends reuse."
tool: password-gen
related: [qr-gen]
updated: 2026-11-16
---

Most accounts are not broken into by someone guessing a clever password. They are broken into because the same password was used on another site that leaked, and attackers simply tried that email and password everywhere else. So a strong password has two jobs: be hard to guess, and be used in exactly one place. This guide covers both, using the [Password Generator](/tools/password-gen/) for the first part.

## Generate a password step by step

1. Open the [Password Generator](/tools/password-gen/). A 16-character password using lowercase, uppercase, numbers and symbols is generated straight away.
2. Drag the **Length** slider. Its range is set by **Min chars** and **Max chars** (8 and 32 by default). To go longer than 32, raise **Max chars**; it accepts up to 128.
3. Tick or untick **Lowercase**, **Uppercase**, **Numbers** and **Symbols**. At least one character from each ticked group is always included, and the positions are shuffled.
4. If a site insists on several digits or special characters, set **Min numbers** or **Min special** (0 to 9).
5. Tick **Avoid ambiguous characters** if you will ever read the password aloud or type it from paper. It removes look-alikes such as `I`, `l`, `1`, `O`, `0`, `o`, `B`, `8`, `S`, `5`, `Z` and `2`.
6. Check the **Strength** label, then click **Copy**. The refresh icon (**Regenerate**) creates a new one with the same settings; any change to the settings also creates a new password.

Generation uses your browser's cryptographic random number generator (`crypto.getRandomValues`), not `Math.random`, and picks characters without bias toward any of them.

## Length beats complexity

The strength label is based on entropy: how many guesses a random password of that shape would need. Each added character multiplies the number of possibilities by the size of the character pool, so length grows strength much faster than adding a character type does. With the tool's own character sets:

| Settings | Approx. entropy | Strength label |
| --- | --- | --- |
| 8 characters, all four types | 52 bits | Fair |
| 12 characters, all four types | 77 bits | Strong |
| 16 characters, all four types | 103 bits | Very strong |
| 16 characters, lowercase only | 75 bits | Strong |
| 22 characters, lowercase only | 103 bits | Very strong |

A 22-letter lowercase password is as strong as a 16-character mixed one, and much easier to type on a phone keyboard. The labels switch at 40, 70 and 100 bits.

Two details worth knowing:

- **Avoiding ambiguous characters shrinks the pool** from 87 to 75 characters, so 16 characters drops to about 100 bits and shows **Strong** instead of **Very strong**. Add one or two characters to make up for it.
- **If a site rejects symbols**, untick **Symbols** and add a couple of characters. Sixteen letters and digits give about 95 bits; 18 give about 107.

The meter only describes passwords this tool generated. A password you invented yourself, like `Jakarta2026!`, follows a predictable pattern and is far weaker than its length suggests.

## When a passphrase is better

Some passwords you must actually remember and type: the master password for your password manager, your computer login, perhaps your phone. For those, a passphrase of random words works better than a jumble of symbols. The generator doesn't make passphrases, so do it like this:

1. Use a published word list made for this purpose, such as the EFF large word list, which has 7,776 words.
2. Choose the words randomly, for example by rolling five dice per word as the list explains. Don't pick words yourself; people pick predictable ones.
3. Use at least six words. Each word from a 7,776-word list adds about 12.9 bits, so six words give about 77 bits and eight about 103.

A result like `crane-velvet-oyster-mural-pebble-lantern` is long, random and still typeable. A famous quote or song lyric is not random, however long it is.

## Use a password manager so you never reuse

Nobody can remember a unique 16-character password for every account, and that's fine; you shouldn't try. A password manager stores them, encrypted, behind one master passphrase.

- Options include the managers built into Apple devices, Google Chrome and Android, Firefox, and standalone apps such as Bitwarden, 1Password or KeePassXC.
- When you sign up somewhere, generate a password, paste it in, and save it in the manager straight away, before you close the tab.
- Change the reused passwords on your most important accounts first: email, banking and e-wallets, and social media. Whoever controls your email can reset almost everything else.
- Turn on two-factor authentication wherever it is offered, preferably with an authenticator app or passkey rather than SMS.
- Never send passwords by chat or email. To share a Wi-Fi password with guests, a Wi-Fi QR code made with the [QR Code Generator](/tools/qr-gen/) avoids reading it out.

## Privacy

Passwords are generated in your browser and are not sent to or stored on any server. Once you have copied one, close the tab or press regenerate if others can see your screen.

## FAQ

### Is 16 characters enough?

For a random password stored in a password manager, 16 characters with all four types (about 103 bits) is well beyond what online or offline guessing can reach. Use more if a site allows it; it costs you nothing when the manager does the typing.

### Should I change my passwords regularly?

Not on a timer. Change a password when there is a reason: the site reports a breach, you shared it, or you reused it elsewhere. A unique strong password that never leaks doesn't get weaker with age.

### Why does a site reject my generated password?

Some sites limit the length or which symbols are allowed. Lower **Max chars**, or untick **Symbols** and make the password longer to keep the strength up.

### Is it safe to generate passwords in a browser?

The randomness comes from the same cryptographic generator that browsers use for encryption, and the password stays on your device. The bigger risk is what happens next, so store it in a password manager rather than a notes file or screenshot.
