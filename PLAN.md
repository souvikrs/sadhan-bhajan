# Sadhan Bhajan (for Thakur & Souvik): plan

A private web app for Souvik's own sadhana. It opens on the phone like an app, works offline, and holds everything in one place: the sitting, the day, prayer and reading. It is built only from what Sree Sree Thakur gave, as printed in the Ritwik book and recorded in the Nām-Dhyān compilations.

## Rules the app keeps

1. **Thakur's words are exact.** The উপদেশ-পত্র, স্বতঃ-অনুজ্ঞা, সংকল্প and দ্রষ্টব্য are the printed Ritwik-book text (pp. ২১–২৭), with spelling as printed. English is a close rendering, and the English edition is quoted where it exists. Nothing invented is put in quotation marks.
2. **Nothing extra.** No music, no ambient sound, no gamification, no streak counts. The only sound is an optional single soft tone when a timer ends, so you know the time is up without opening your eyes. It can be turned off.
3. **Regularly irregular.** The log shows days you sat; it never scolds. A hard day has its own button, the দ্রষ্টব্য minimum.
4. **Private.** This is for initiated use only, including the Name.

## Privacy: how it can be public on GitHub and still private

GitHub Pages is free only for a public repository. So everything private is **encrypted** before it goes to GitHub (AES-256-GCM, with the key derived from a passphrase by PBKDF2-SHA256, 600,000 rounds). The repository and website hold only scrambled data. The app asks for the passphrase once on each device, then remembers it on that device.

- The passphrase lives in `.passphrase` in this folder. That file is never committed.
- The source content lives in `content/`, which is also never committed. Only `site/` (the encrypted build) is published.
- The Ritwik book and Dikshanuchalan go in as encrypted page images, so they never appear in the clear.

## Screens

**আজ · Today (the dashboard).** Opens on the right thing for the hour:
- Before dawn and morning: the dawn sitting, then Ishtabhriti before food or water, then morning prayer.
- During the day: the Name running through work, and the 2nd-dapha savasana (3–4 times, 5–6 min) with a counter.
- Evening: evening prayer.
- Night: the night sitting.

It also shows today's checklist (stored on the phone only), one "Before the Sitting" session (one of 38, in turn), and one of Thakur's sayings.

**বসা · Sit (the guided sitting).** Steps (ক) to (ছ), one screen at a time, Bangla and English:
1. Place and posture, (ক) and (খ).
2. Kindle love, then the pranam, (গ).
3. Eyes open on Thakur's photo for 1–2 minutes, doing the Name, (ঘ). The screen shows the chakra photo with a gentle countdown.
4. Eyes closed at the tesra til, under the chadar, (ঙ). The timer is set to 30, 45 or 60 minutes or a custom time, (চ). The screen goes dark and stays awake.
5. The closing pranam and স্বতঃ-অনুজ্ঞা, (ছ).

Shortcuts on the same screen:
- **Hard day:** the দ্রষ্টব্য minimum, Name at the tesra til.
- **শবাসন:** the 2nd-dapha savasana timer.
- **Two minutes, ten minutes:** a short sit (May 1923).

**প্রার্থনা · Prayer.** Your channel's morning and evening prayer videos, set to play at 1.5× (this needs internet). The prayer's sections are listed with timestamps so you can jump to one, with the read-along text wherever it shows on screen.

**পাঠ · Read.**
- উপদেশ-পত্র, ইষ্টভৃতি, স্বতঃ-অনুজ্ঞা and সংকল্প, exactly as printed.
- নাম: the Name, with Thakur's words on it.
- The Nām-Dhyān guide (the kit's document 2).
- The full compilations in English and Bangla, with search.
- Before the Sitting: all 38 sessions, each with its anchor saying and a Notion link.
- Books: the Ritwik book (all 3 parts) and Dikshanuchalan as page viewers.
- The guided meditation, Session 01 (audio).
- Notion and Claude-doc links for deeper reading.

**খাতা · Log.** A calendar of the days you sat, plus export and import of your record as a file for backup.

**Settings.** Bangla + English, Bangla only, or English only; day or night theme; the end tone on or off; default sitting length.

## Look

The Master Within brand:
- **Colours:** coral `#F86643` for the main action (night `#14212B` text on it), blue `#44ABE5`, navy `#365269` headings, ink `#243746` body, mist `#EFF6FA` surfaces, and night `#14212B` in the night theme.
- **Type:** Source Serif 4 for headings, DM Sans for English text, Noto Serif Bengali for Bangla.

The night theme is the default during the night sitting.

## Build

- **Code:** plain HTML, CSS and JavaScript. There is no framework, so there is nothing to keep updated.
- **Offline and install:** a service worker caches everything, so after the first unlock the app opens with no internet (prayer videos excepted). "Add to Home Screen" on iPhone makes it a full-screen app.
- **Build script:** `build.py` encrypts `content/` into `site/`. Publishing is `git push`, after which GitHub Pages serves `site/`.
- **Data:** the log and checklists stay on the device (localStorage). Export or import JSON for backup.

## Later (not in v1)

- The full text of the 38 Before-the-Sitting scripts inside the app (v1 links to Notion).
- The Bengali guided-sessions database.
- Reminders. Web push on iPhone needs the home-screen app and a server; skipped for now.
