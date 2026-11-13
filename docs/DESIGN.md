# Design: Assay

Keytell is an assay of one claim: a sample is taken, weighed and recorded. The interface keeps the
house system it shares with Berthright (Fraunces display at optical size 144, Instrument Sans text,
IBM Plex Mono labels and numbers, plates with brass corner ticks, spring motion, the same
accessibility bar) and changes the ground, palette and motif so the two never read as one site.

## Structure

- **The hero** takes the structure of a dark inset panel on a light page: a rounded vault panel set in
  from the page edges, a mono eyebrow with a status dot, a three-line display headline whose last line
  carries the accent, one paragraph, two pill buttons (one solid, one outline with a round arrow chip),
  a row of question chips, and a mono strip along the panel's foot with the data source, the claim
  status read from chain, a live UTC clock and "Scroll". The right half is not an illustration: it is
  the **Key Wall**, the data itself.
- **Below the hero** the site is an editorial research publication: centred serif lead questions,
  a numbered briefing library of issue cards (each with a drawn plate and a copper kicker), brief
  pages that each ask one question, and the memo as an issue page.

## Grounds and colour

| Token | Hex | Job |
|---|---|---|
| `--ledger` | `#f1ede4` | page ground: ledger paper with a 28 px rule and a red margin rule at 64 px on wide screens |
| `--vault` | `#0b1013` | hero panel, mobile menu, footer |
| `--copper` / `--copper-ink` | `#d27a2c` / `#9a5212` | the accent and the FC series; copper-ink for text on ledger (5.0:1) |
| `--verdigris` / `-ink` | `#4aa391` / `#2b6e60` | evidence for, passed (5.1:1) |
| `--oxide` / `-ink` | `#b8442f` / `#9c3522` | evidence against, failed, refusals (6.1:1) |
| `--brass` / `--brass-ink` | `#a98b54` / `#6f5a2f` | plate ticks, eyebrows (5.9:1 on vault, 5.7:1 on ledger) |
| `--ink` / `--ink-2` | `#14181b` / `#4a5156` | text on ledger (6.9:1 for secondary) |
| `--fog` | `#a7b0b5` | secondary text on vault (8.7:1) |

Series colours are fixed on every chart: FC-signed copper, full access fog grey, implicit a lighter
grey, meta transactions hatched copper, DAA slate blue `#5f7d95` dashed, price brass dotted, USDC ink.
Lines are labelled directly at their ends; no chart relies on a legend.

## The Key Wall

One drawn brass key per week from 2022, 20 columns by 14 rows on wide screens and 7 by 40 on phones.
Fill is the week's FC share on a fixed scale (0, 20, 40 percent and above). A notched bow marks a
flagged episode week; an outlined bow an out-of-sample week; a dashed key a week not measured yet.
Keys swing in column by column on load and rest under reduced motion. Hover shows the week, the share
with its interval, DAA and the source. A screen-reader table carries every value.

## Charts

Hand-built SVG with d3-scale, d3-shape and d3-array. Each chart sits on a plate with a question as
its title, one generated sentence, the chart, a source line with dates, and a "Show the SQL"
disclosure with copy, open-in-BigQuery and view-on-GitHub buttons and the bytes scanned. Vertical
rules mark the in-sample and out-of-sample starts. Gaps stay gaps. Losses are not smoothed.

## Checked

e2e/layout.mjs: 8 routes on 8 devices, no horizontal scroll, no headline collisions, tap targets of
at least 44 px, axe WCAG 2.2 AA, no console errors.
