# SimVest — Functional Web MVP (v0.2)

A **working, client-side demonstration of the SimVest business simulation studio**, built from the November 2026 SimVest product proposal. This is **not** only a design/mockup.

## Run it

**Fastest:** Open `SimVest_Standalone.html` (provided separately) in a modern browser. It is a self-contained version with CSS and JavaScript embedded, and does not require internet or installation.

**Source project:** Keep `index.html`, `styles.css`, and `app.js` in the same directory. Open `index.html` in a modern browser. Alternatively, run a local server from this folder:

```bash
python -m http.server 8000
# Visit http://localhost:8000
```

## Working areas

- **Overview:** Business KPIs, charted financial outlook, cash shortfalls, and quick links.
- **Business setup:** editable details for location, startup funds, one-time investment, loan balance, principal repayments, annual interest, sales, capacity, pricing, cost per unit, wages, rent, utilities, and macro assumptions.
- **Business types:** food/restaurants, retail/trading, and logistics/delivery, each with tailored fields and starter assumptions.
- **Simulation:** 12, 24, or 36 monthly rows and chart views for revenue, profit, cash flow, and cash balance.
- **Scenarios:** base case, demand falling, costs increasing, growth opportunity, and a custom 5-control scenario builder.
- **Reports:** interpretable findings, risk flags, monthly CSV export, JSON project export, print-to-PDF.
- **Saved projects:** save, load, duplicate, delete, and import JSON in local browser storage.

## What the model does

Monthly demand grows at a user-adjustable rate and is capped at operating capacity. Monthly price grows at the chosen rate. Unit and fixed costs inflate from a user-adjustable annual cost-inflation assumption. Revenue, direct cost, gross profit, fixed costs, interest on declining loan principal, net profit, principal repayments, and cash balance are computed each month. Scenarios modify demand, unit cost, selling price, and fixed expense levels from a chosen start month.

**Example base model:** a restaurant with 45 meals/day at ₦2,700, variable cost ₦1,200/meal, 26 operating days, ₦920,000 fixed monthly expenses, ₦5m available funds, ₦2.5m upfront setup costs, ₦1.2m debt, and ₦80,000/month principal payments. ALL these figures are illustrative, not real-world benchmarks.

## Important current limitations

- **Not a validated financial forecasting engine.** Outputs are *conditional scenarios*, not predictions or investment advice.
- Nigeria is the only country choice in the MVP; city and area are descriptive fields. **No live location intelligence, country statistics, currency FX, or local prices are connected.** The local cost factor is manual.
- Taxes/VAT, depreciation, inventory holding and stockouts, unpaid customer invoices, supplier payment delays, sales tax and demand-price elasticity are not modelled. Business-to-business sector specifics are simplified.
- No cloud database, user accounts, server API, collaboration, sync, or deployment. Browser storage may be deleted; export project JSON as backup.
- Accessibility and full cross-browser/device QA are pending; calculation tests pass locally.

## Check calculations

```bash
node tests/engine.test.cjs
```

## Moving to production

1. Validate each business module against anonymised real Nigerian business records.
2. Add proper double-entry accounting / cash-flow modelling, working capital, stock and tax modules.
3. Replace demonstration assumptions with documented, timestamped data sources and manual overrides.
4. Introduce an API and accounts (Next.js/React web frontend, Python/FastAPI simulation engine, PostgreSQL), database migrations, versioned simulation results, authorization, and security/privacy controls.
5. Add automated end-to-end browser tests, resilient offline states, and production deployment.

