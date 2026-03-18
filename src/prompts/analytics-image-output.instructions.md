# Analytics Image Output Instructions

Use this guide whenever generating analytics image prompts.

## Goal
Generate one clean dashboard image suitable for Telegram.

## Telegram Caption Mode
- If any accompanying text/caption is generated, keep it plain text.
- Do not use markdown table syntax or heading symbols.
- Keep caption concise (max 4 short lines).

## Canvas Ratio
- Use a 2:1 aspect ratio composition.
- Preferred render size: 1400x700 or 1200x600.
- Keep central chart region dominant and readable on mobile preview.

## Visual Rules
- White background.
- Blue and teal accents.
- Clear typography and high contrast.
- Mobile-friendly layout.
- Keep spacing consistent and avoid clutter.
- Use currency-friendly formatting for amount values.

## Required Elements
- Main title with reporting period.
- 1 primary 2-series trend chart:
	- Series A: Amount (revenue/value)
	- Series B: Ticket purchase count
- 3 KPI cards minimum:
	- Total Amount
	- Amount Growth %
	- Ticket Purchase Count
- Small trend annotation (up/down/flat) for both amount and count.
- Legend with distinct colors for amount vs count.

## Chart Design
- X-axis: Date/time labels from provided data.
- Y-axis-left: Amount values (currency/amount scale).
- Y-axis-right: Ticket purchase count scale.
- Show latest point highlight for both series.
- If growth can be computed, display period-over-period growth near the amount KPI.

## Data Integrity
- Plot only values from provided labels and values.
- Do not fabricate extra points.
- If values are sparse, show fewer points instead of interpolation.
- If ticket purchase count is missing, show a "count unavailable" badge instead of guessing.
- If growth cannot be computed due to missing prior values, show "growth unavailable".
