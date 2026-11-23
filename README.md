# TABLE TENNIS RUSH

A mobile-first 3D table tennis game prototype built with Three.js, Vite and Capacitor 7.

## Features
- First-person-style view: no visible player character; only your paddle and the opponent are shown.
- Touch/mouse paddle movement and swipe spin.
- First to 7 points.
- Increasingly difficult bot opponents.
- Coins for match results, paddle/ball colour shop, and local save data.
- Synthesized hit/table sounds and simple background music using Web Audio.
- iOS Capacitor project setup and GitHub Actions workflow for an unsigned IPA artifact.

## Run locally
```bash
npm install
npm run dev
```

## Build web version
```bash
npm run build
```

## Build iOS in GitHub Actions
1. Create a new GitHub repository named `table-tennis-rush`.
2. Upload the contents of this ZIP to the repository root (not the containing folder).
3. Open **Actions** and run **Build TABLE TENNIS RUSH iOS**.
4. Download the `TABLE-TENNIS-RUSH-IPA` artifact from the successful run.

The workflow creates an unsigned IPA. Installing it on a real iPhone still requires a valid signing/install method.

## Controls
- Drag left/right to move your paddle.
- Swipe while moving to add spin.
- Win matches to earn coins and unlock colours.

This is a playable starter version. The gameplay, AI and visuals can be expanded in later versions.
