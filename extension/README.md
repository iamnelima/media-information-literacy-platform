# MILES Browser Extension

This folder contains an unpacked Chrome/Edge extension for MILES.

## What it does

- Shows a small analysis launcher on social media sites when you select text.
- Sends the selected text to your local MILES server for verification.
- Provides a popup where you can paste text manually or reuse the current selection.
- On X / Twitter, it can also pick up the visible tweet text even when nothing is selected.

## Supported sites

- Facebook
- X / Twitter
- Instagram
- LinkedIn
- Reddit
- YouTube
- Threads
- TikTok

## Setup

1. Start the MILES server locally, usually on `http://localhost:3003`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select this `extension` folder.

## Notes

- The extension expects the local analysis endpoint at `http://localhost:3003/api/extension/analyze`.
- You can change the server URL from the popup if your app runs on a different port.
