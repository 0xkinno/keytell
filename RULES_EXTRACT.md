# Rules extract

Copied from the live page https://nearhackathon.com/ and https://nearhackathon.com/HACKATHON.md on
13 Nov 2026. Reread both before submitting; dates and rules may change.

## Track

> **02 / INV. Investment Thesis. Make the long-term case.**
> "Build a long-term investment thesis for NEAR and back it with data: onchain analytics, live
> dashboards and models anyone can re-run. Judged on the evidence, not the conviction."
> Tags: ONCHAIN DATA, DASHBOARDS, RESEARCH. Submission API track id: `thesis`.

## Dates (UTC, and West Africa Time = UTC+1)

| Event | UTC | WAT |
|---|---|---|
| Hackathon starts | 1 Nov 2026, 00:00 | 1 Nov 2026, 01:00 |
| Development ends (submission deadline) | 14 Nov 2026, 23:59 | 15 Nov 2026, 00:59 |
| Our own cut-off (two hours early) | 14 Nov 2026, 21:59 | 14 Nov 2026, 22:59 |
| Judging starts | 16 Nov 2026, 00:00 | 16 Nov 2026, 01:00 |
| Results announced by | 18 Nov 2026, 23:59 | 19 Nov 2026, 00:59 |

The deployment stays frozen from submission through 18 Nov (Q-012 asks hosted demos to stay up to
18 Nov, ideally 25 Nov).

## Judges

Illia Polosukhin (NEAR Protocol), Eddy Lazzarin (a16z crypto), Mert Mumtaz (Helius), Avichal Garg
(Electric Capital), Kain Warwick (Synthetix and Infinex), Haseeb Qureshi (Dragonfly), Stepan
Gershuni (cyber.Fund), and Claude Code and Codex, which screen every project first: "they check that
it runs and does what the README says. The human judges above make the decisions" (Q-017: screening,
not deciding).

Criteria are not published with weights. The FAQ: "Previous NEAR hackathons evaluated technical
implementation, design, impact, originality and sustainability." The README maps all five.

## Requirements

1. Public repository by the deadline ("Judges can't open a private one"), with a LICENSE (Q-014).
2. A public post on X that says the project was built at NEAR HACKATHON, tags @NEARProtocol and
   #NEARHackathon (optionally @NearLegion and @NearBuilders), with a demo video or screenshots.
3. One submission per project, through the form or `POST https://nearhackathon.com/api/applications`,
   only after the human confirms the exact payload. Mistakes go through
   https://nearhackathon.com/request-changes, never a second submission.
4. Testnet-only projects are eligible (Q-010). Libraries and AI code are allowed and must be listed
   in the README (Q-005).

## Form fields

Project name (2 to 80), Team lead (2 to 80), Email (max 160), Team size (`1`, `2 - 4`, `4 - 6`,
`6 - 8`, `8+`), Tracks (`thesis`), NEAR mainnet wallet for the prize (the human's own account; never
created or invented for them), Repository link (public, unique), Demo post link, "What did you
build?" (20 to 2,000 characters), consent ("I agree that the organizers may use these details to
review our submission and contact us about this hackathon."). The `website` field is a spam trap in
the API: leave it empty.

## Q-015: one person, two projects

> "Allowed if projects are independent and disclosed: each README names the other project. Not the
> same project twice. One person, at most 2 different projects."

Keytell's README names Berthright (NFTs That Do Something) in Disclosures. Berthright's README must
name Keytell; that one line is added only after Kinnoski approves.

## Prizes

Per track: 1st $10K, 2nd $3K, 3rd $2K, paid in NEAR; one grand prize of $55K overall.
