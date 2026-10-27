# Brand logos

Drop an official logo here and the app uses it automatically instead of the coloured badge.
Only add logos you have the right to use, for example from the brand's own press or media kit.

**File name = biller id + extension**, lower case with hyphens: `tnb.png`, `air-selangor.png`, `maybank.webp`.
Formats: PNG, JPG or WebP (square or near-square, 256 px or larger, transparent or white background).
SVG is not read directly; export it to PNG first.

The ids are the `id` values in `src/domain/billers.ts` (bills), `src/domain/banks.ts` (banks, wallets, loan lenders),
`src/domain/brandLookup.ts` (PTPTN, MBSB, AEON Credit), `src/domain/loanTracker.ts` (pay later) and
`src/domain/subscriptions.ts`. Examples: `tnb`, `sesb`, `air-selangor`, `indah-water`, `unifi`, `unifi-mobile`, `maxis`,
`celcomdigi`, `umobile`, `astro`, `aia`, `maybank`, `cimb`, `publicbank`, `rhb`, `hongleong`, `ambank`, `bsn`, `bankislam`, `ptptn`.

Then run `npm run brands` (it also runs before `npm start`, `npm run web` and `npm test`) and commit the image
together with the regenerated `src/ui/brandLogos.ts`.

A logo wins over the bundled brand mark and over the monogram badge. Nothing else needs to change.
