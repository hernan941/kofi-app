<p align="center">
  <img src="docs/images/logo.png" alt="Kofi app icon: a tuxedo cat" width="112">
</p>

<h1 align="center">Kofi</h1>

<p align="center">
  A calm business companion for artists and small makers.
</p>

<p align="center">
  <img src="docs/images/home.png" alt="Home screen with weekly and monthly sales" width="240">
  &nbsp;&nbsp;
  <img src="docs/images/record-sale.png" alt="Recording a sale by picking products" width="240">
  &nbsp;&nbsp;
  <img src="docs/images/calendar.png" alt="Calendar with sales marked by intensity and a weekly streak" width="240">
</p>

## Why Kofi

Most people who sell what they make never set out to run the numbers. Spreadsheets feel like homework, and accounting apps assume you already know the language.

Kofi works more like a habit tracker than a ledger. You note what you sold, at the end of a fair or at the end of the week, and it shows you your rhythm. Along the way you come to understand your money: what comes in, what your work costs you, and what you keep.

## What guides it

- **Recording is quick.** A few taps, with everything optional out of the way until you ask for it.
- **Nothing is demanded.** Costs and profit appear once there is data that makes them useful.
- **It never scolds.** A week without sales is also worth recording, and it keeps your streak going.
- **Your data stays with you.** No account, no server, and nothing sent to the internet. Data leaves your phone only when you share a backup or an export.

## What it does

- Records sales by product, version, quantity and price.
- Shows weekly and monthly totals, a sales calendar and a monthly summary.
- Offers short, practical tips after a sale.
- Sends gentle weekly reminders that you can turn off.
- Exports to CSV, and backs up and restores everything, photos included.

The interface is in Spanish, and amounts are in Chilean pesos (CLP).

## Status

Version 1 is local only and not published in any store. It is built and tested on Android. The codebase also targets iOS, which has not been verified yet.

## Development

Built with Expo, React Native and TypeScript, on SQLite with Drizzle, HeroUI Native and Uniwind.

Requires Node.js 22 or later. Building for Android also needs the Android SDK and a JDK.

```sh
npm install
npm run android
```

Run the checks with:

```sh
npm run typecheck
npm run lint
npm test
```

Technical decisions are recorded in [docs/architecture](docs/architecture/README.md), and the product vision is in [docs/product.md](docs/product.md). Both are in Spanish.

The screenshots use sample data.
