# Analytics Output Instructions

Use this format for all sales and summary outputs.

## Global Rules
- Use only provided data context.
- If data is missing, explicitly state what is missing.
- Keep tone concise and business-focused.
- Do not invent values.
- Use numeric formatting consistently:
	- Amount: 2 decimal places
	- Percentages: 2 decimal places + `%`
	- Counts: integer where possible
- Mention timezone when interpreting date windows (24h/48h/7d).
- Always include row/filter references used to compute metrics.
- Telegram rendering mode:
	- Output plain text only.
	- Do not use markdown tables.
	- Do not use heading symbols like `#`, `##`, `---`, `**`.
	- Use short section labels and bullet lines.

## Standard Output Structure
Snapshot:
- One-line summary of the current performance.

Key Metrics:
- Revenue
- Orders
- Conversion (if available)
- Trend direction

Insights:
- 2 to 4 bullet points explaining notable movement.

References:
- List the exact column names used.
- Mention key filters used (date range, currency, category, etc.).

Actions:
- 2 practical next steps.

## Action-Specific Templates

### ai_analytics_all
Use full structure and include these metric lines under Key Metrics:
- Total Revenue
- Total Transactions
- Average Ticket Value
- Top Ticket Category by Revenue

### ai_revenue_24h
Focus: last 24 hours.

Required:
- Window start/end timestamps
- Revenue in window
- Transaction count in window
- Avg revenue per transaction

Insights must include:
- Largest transaction in window
- Any anomaly or spike note

### ai_revenue_48h
Split into 2 blocks:
- Previous 24h
- Latest 24h

Required comparison lines:
- Revenue delta (absolute and %)
- Transaction count delta (absolute and %)
- Short interpretation of direction

### ai_revenue_7d
Include:
- 7-day total revenue
- Daily average revenue
- Best day and worst day
- 7-day trend direction

Insights should mention weekday/date pattern if visible.

### ai_top_products
Output format:
1. Ranked list (Top 5 max)
2. For each item: revenue, quantity, share %
3. Why each top item is performing (data-based)

### ai_orders_summary
Include:
- Total order count
- Paid vs unpaid counts (if payment status exists)
- Source split (CLIENT/other)
- Currency split

### ai_conversion
If conversion denominator is available:
- Conversion rate = purchases / total intents

If denominator is not available:
- State "Conversion unavailable"
- Provide best proxy metrics from existing columns

### ai_kpi_refresh
Return a compact KPI block only:
- Revenue
- Transaction count
- Avg ticket value
- Recent trend direction

Keep this action to short summary style (max 8 lines before insights).

## Fallback Behavior
- If no rows match filters: return "No matching records" with filter recap.
- If required columns are missing: return "Missing required columns" and list which ones.
- If date parsing fails: return "Invalid date values in source" and proceed with non-date metrics where possible.
