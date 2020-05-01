AYT Translator
==============

AYT is the acronym for "**A**uto Virtual **Y**outuber **T**ranslator", ~~not **A**idoru Virtual **Y**ou**T**uber~~.

## Available Scripts

In the project directory, you can run:

### `ts-node src/server.ts`

Start the translation service. The API is available at [http://localhost:3001](http://localhost:3000).

* If you're going to use Microsoft Translator, set environment variable `MICROSOFT_API_KEY`.

### `yarn start`

Start the frontend for the translation service. Open [http://localhost:3000](http://localhost:3000) to view it.

### `userscript.js`

Add this user script to your TamperMonkey to use AYT as your Twitter translation backend.
