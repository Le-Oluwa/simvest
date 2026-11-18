
/* SimVest Retail & Commerce v0.5
   Illustrative financial simulation engine.
*/

(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const DB = window.SimVestData;

  if (!DB) {
    throw Error(
      'economic-data.js must load before app.js'
    );
  }

  const DRAFT_KEY = 'simvest_draft_v05';
  const SAVE_KEY = 'simvest_projects_v05';

  const defaults = {
    name: 'My retail business',
    category: 'provisions',
    city: 'Lagos',
    area: '',
    start: '2023-01',
    months: 12,

    capital: 5000000,
    loan: 0,
    annualInterest: 18,
    loanTerm: 24,
    setupCost: 1000000,

    price: 5500,
    unitCost: 3600,
    dailyDemand: 35,
    dailyCapacity: 90,
    openDays: 26,

    openingUnits: 300,
    monthlyPurchases: 950,
    shrinkage: 1,

    rent: 180000,
    salaries: 240000,
    electricity: 70000,
    otherCosts: 95000,

    annualInflation: 20,
    demandGrowth: 0,
    priceGrowth: 0,
    fxShare: 0,
    fuelShare: 0,

    custom: {
      demand: -15,
      cost: 15,
      price: 0,
      fixed: 0,
      month: 4
    }
  };

  const categories = {
    provisions: {
      label: 'Provision store / mini-mart',
      price: 5500,
      cost: 3600,
      demand: 35,
      capacity: 90,
      stock: 300,
      buy: 950
    },

    supermarket: {
      label: 'Supermarket',
      price: 6800,
      cost: 4750,
      demand: 95,
      capacity: 220,
      stock: 700,
      buy: 2500
    },

    electronics: {
      label: 'Electronics and devices',
      price: 95000,
      cost: 78500,
      demand: 5,
      capacity: 22,
      stock: 35,
      buy: 130
    },

    pharmacy: {
      label: 'Pharmacy / health retail',
      price: 8200,
      cost: 5900,
      demand: 65,
      capacity: 130,
      stock: 300,
      buy: 1700
    },

    fashion: {
      label: 'Fashion and clothing',
      price: 18500,
      cost: 10700,
      demand: 15,
      capacity: 50,
      stock: 200,
      buy: 380
    },

    ecommerce: {
      label: 'Online retail (own inventory)',
      price: 12000,
      cost: 8000,
      demand: 25,
      capacity: 80,
      stock: 230,
      buy: 700
    },

    wholesale: {
      label: 'Wholesale / distribution',
      price: 34000,
      cost: 28900,
      demand: 12,
      capacity: 45,
      stock: 160,
      buy: 310
    }
  };

  const cases = {
    base: {
      label: 'Base case',
      detail: 'Business as entered',
      demand: 0,
      cost: 0,
      price: 0,
      fixed: 0,
      month: 1
    },

    demand: {
      label: 'Demand drop',
      detail: 'Sales volume −25% from month 4',
      demand: -25,
      cost: 0,
      price: 0,
      fixed: 0,
      month: 4
    },

    costs: {
      label: 'Cost shock',
      detail: 'Purchase cost +25%, expenses +10%',
      demand: 0,
      cost: 25,
      price: 0,
      fixed: 10,
      month: 4
    },

    growth: {
      label: 'Growth',
      detail: 'Demand +20%, expenses +10%',
      demand: 20,
      cost: 0,
      price: 0,
      fixed: 10,
      month: 4
    },

    custom: {
      label: 'Custom scenario',
      detail: 'Choose your own changes'
    }
  };

  const names = {
    dashboard: 'Dashboard',
    setup: 'Business setup',
    simulation: 'Simulation',
    scenarios: 'Scenarios',
    data: 'Economic data',
    saved: 'Saved projects'
  };

  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ??
        fallback;
    } catch {
      return fallback;
    }
  };

  const store = (key, value) => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );
    } catch {
      toast('Browser storage unavailable');
    }
  };

  const escape = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[c]
    );

  const clamp = (v, min = 0, max = 1e12) =>
    Math.min(
      max,
      Math.max(min, Number(v) || 0)
    );

  const money = n =>
    (n < 0 ? '−' : '') +
    '₦' +
    Math.round(
      Math.abs(n || 0)
    ).toLocaleString('en-NG');

  const short = n => {
    const a = Math.abs(n || 0);

    return (n < 0 ? '−₦' : '₦') +
      (
        a >= 1e9
          ? (a / 1e9).toFixed(2) + 'bn'
          : a >= 1e6
          ? (a / 1e6).toFixed(2) + 'm'
          : a >= 1000
          ? (a / 1000).toFixed(1) + 'k'
          : Math.round(a)
      );
  };

  const monthAt = (start, i) => {
    const [y, m] = start.split('-').map(Number);

    return new Date(
      Date.UTC(y, m - 1 + i, 1)
    ).toISOString().slice(0, 7);
  };

  let p = {
    ...defaults,
    ...read(DRAFT_KEY, {})
  };

  p.custom = {
    ...defaults.custom,
    ...p.custom
  };

  let page = 'dashboard';
  let scenario = 'base';
  let chartMetric = 'cash';

  function toast(message) {
    const el = $('toast');

    el.textContent = message;
    el.classList.add('show');

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
      el.classList.remove('show');
    }, 2600);
  }

  // ---------------------------------------
  // FINANCIAL SIMULATION ENGINE
  // ---------------------------------------

  function simulate(
    data = p,
    scenarioName = 'base'
  ) {
    const chosen =
      scenarioName === 'custom'
        ? data.custom
        : cases[scenarioName];

    const rows = [];

    let cash =
      clamp(data.capital) +
      clamp(data.loan) -
      clamp(data.setupCost) -
      clamp(data.openingUnits) *
      clamp(data.unitCost);

    let stock = clamp(data.openingUnits);
    let avgCost = clamp(data.unitCost);

    let purchaseCost = clamp(data.unitCost);
    let price = clamp(data.price);
    let demand = clamp(data.dailyDemand);

    let fixedCosts =
      clamp(data.rent) +
      clamp(data.salaries) +
      clamp(data.electricity) +
      clamp(data.otherCosts);

    let balance = clamp(data.loan);

    const rate =
      clamp(data.annualInterest) / 1200;

    const term = Math.max(
      1,
      clamp(data.loanTerm, 1, 360)
    );

    const payment =
      balance === 0
        ? 0
        : rate > 0
        ? balance * rate /
          (1 - Math.pow(1 + rate, -term))
        : balance / term;

    for (
      let i = 0;
      i < clamp(data.months, 1, 36);
      i++
    ) {
      const month = monthAt(
        data.start,
        i
      );

      const economic = DB.changes(
        month,
        data.annualInflation,
        data.fxShare,
        data.fuelShare
      );

      // Update business costs after month 1.
      if (i > 0) {
        purchaseCost *=
          economic.procurementFactor;

        fixedCosts *=
          economic.fixedFactor;

        price *=
          1 +
          clamp(
            data.priceGrowth,
            -90,
            500
          ) / 100;

        demand *=
          1 +
          clamp(
            data.demandGrowth,
            -90,
            500
          ) / 100;
      }

      const shock =
        i + 1 >= Number(chosen.month)
          ? chosen
          : cases.base;

      const shockCost = Math.max(
        .1,
        1 +
        Number(shock.cost || 0) / 100
      );

      const demandUnits = Math.max(
        0,
        demand *
          Math.max(
            0,
            1 +
            Number(shock.demand || 0) / 100
          )
      );

      const desiredSales =
        Math.min(
          demandUnits,
          clamp(data.dailyCapacity)
        ) *
        clamp(data.openDays, 0, 31);

      // Stock purchasing
      const bought =
        clamp(data.monthlyPurchases);

      const purchaseCash =
        bought *
        purchaseCost *
        shockCost;

      const stockValue =
        stock * avgCost +
        purchaseCash;

      const available =
        stock + bought;

      avgCost =
        available > 0
          ? stockValue / available
          : 0;

      const lost = Math.min(
        available,
        available *
          clamp(
            data.shrinkage,
            0,
            100
          ) / 100
      );

      const sellable =
        available - lost;

      const sold = Math.min(
        desiredSales,
        sellable
      );

      stock =
        sellable - sold;

      // Revenue
      const sales =
        sold *
        price *
        Math.max(
          0,
          1 +
          Number(shock.price || 0) / 100
        );

      // Inventory expense
      const costOfSales =
        (sold + lost) * avgCost;

      const expenses =
        fixedCosts *
        Math.max(
          0,
          1 +
          Number(shock.fixed || 0) / 100
        );

      // Loan calculations
      const interest =
        balance * rate;

      const principal = Math.min(
        balance,
        Math.max(
          0,
          payment - interest
        )
      );

      const debtPaid =
        balance > 0
          ? principal + interest
          : 0;

      balance = Math.max(
        0,
        balance - principal
      );

      // Profit and cash are different.
      const profit =
        sales -
        costOfSales -
        expenses -
        interest;

      cash +=
        sales -
        purchaseCash -
        expenses -
        debtPaid;

      rows.push({
        month,
        sales,
        costOfSales,
        expenses,
        interest,
        profit,
        cash,
        stock,
        inventoryValue: stock * avgCost,
        sold,
        missed: Math.max(
          0,
          desiredSales - sold
        ),
        debt: balance,
        purchaseCash,
        cpiStatus: economic.cpiStatus
      });
    }

    return rows;
  }

  function summary(rows) {
    const total = key =>
      rows.reduce(
        (a, row) => a + row[key],
        0
      );

    const end = rows.at(-1);

    return {
      revenue: total('sales'),
      profit: total('profit'),
      cash: end.cash,
      inventory: end.inventoryValue,
      missed: total('missed')
    };
  }

  // ---------------------------------------
  // USER INTERFACE COMPONENTS
  // ---------------------------------------

  function heading(
    title,
    subtitle,
    buttons = ''
  ) {
    return `
      <div class="heading">
        <div>
          <div class="eyebrow">
            SIMVEST / RETAIL & COMMERCE
          </div>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        <div class="actions">
          ${buttons}
        </div>
      </div>
    `;
  }

  function button(
    text,
    destination,
    primary = false
  ) {
    return `
      <button
        class="btn ${primary ? 'primary' : ''}"
        data-goto="${destination}">
        ${text}
      </button>
    `;
  }

  function tile(
    title,
    value,
    detail = ''
  ) {
    return `
      <div class="card kpi">
        <label>${title}</label>
        <strong>${value}</strong>
        <small>${detail}</small>
      </div>
    `;
  }

  function field(
    label,
    key,
    type = 'number'
  ) {
    return `
      <div class="field">
        <label for="f_${key}">
          ${label}
        </label>

        <input
          id="f_${key}"
          data-key="${key}"
          type="${type}"
          ${type === 'number'
            ? 'step="any"'
            : ''}
          value="${escape(p[key])}">
      </div>
    `;
  }

  function select(label, key, choices) {
    return `
      <div class="field">
        <label for="f_${key}">
          ${label}
        </label>

        <select
          id="f_${key}"
          data-key="${key}">

          ${choices.map(
            ([value, name]) => `
              <option
                value="${escape(value)}"
                ${String(value) === String(p[key])
                  ? 'selected'
                  : ''}>
                ${escape(name)}
              </option>
            `
          ).join('')}
        </select>
      </div>
    `;
  }

  function block(title, fields) {
    return `
      <section class="card pad">
        <h2>${title}</h2>
        <div class="form">
          ${fields.join('')}
        </div>
      </section>
    `;
  }

  function chart(
    rows,
    metric,
    comparison = null
  ) {
    const list = rows
      .map(r => r[metric])
      .concat(
        comparison
          ? comparison.map(r => r[metric])
          : []
      );

    const low = Math.min(...list);
    const high = Math.max(...list);
    const span = high - low || 1;

    const x = i =>
      42 +
      i * 665 /
      Math.max(1, rows.length - 1);

    const y = v =>
      224 -
      178 * (v - low) / span;

    const trace = data =>
      data.map(
        (r, i) =>
          `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[metric]).toFixed(1)}`
      ).join(' ');

    return `
      <div class="chart">
        <svg
          viewBox="0 0 760 260"
          preserveAspectRatio="none"
          role="img"
          aria-label="${escape(metric)} projection chart">

          <line x1="42" y1="224"
            x2="710" y2="224"
            stroke="#dfe5f0"/>

          <line x1="42" y1="46"
            x2="710" y2="46"
            stroke="#e3e8f1"
            stroke-dasharray="4 5"/>

          <text x="4" y="49">
            ${escape(short(high))}
          </text>

          <text x="4" y="227">
            ${escape(short(low))}
          </text>

          <path
            d="${trace(rows)}"
            fill="none"
            stroke="#5369e5"
            stroke-width="3"/>

          ${comparison ? `
            <path
              d="${trace(comparison)}"
              fill="none"
              stroke="#18a39b"
              stroke-width="3"
              stroke-dasharray="7 5"/>
          ` : ''}

          <text x="42" y="248">
            ${rows[0].month}
          </text>

          <text x="635" y="248">
            ${rows.at(-1).month}
          </text>
        </svg>
      </div>

      <div class="legend">
        <span class="dot"></span>
        ${comparison
          ? 'Base case &nbsp;&nbsp; <span class="dot alt"></span>Scenario'
          : 'Simulation'}
      </div>
    `;
  }

  // ---------------------------------------
  // DASHBOARD PAGE
  // ---------------------------------------

  function dashboard() {
    const rows = simulate();
    const s = summary(rows);

    return heading(
      'Business overview',
      'A working financial and inventory simulation using editable inputs.',
      button(
        'Business setup',
        'setup'
      ) +
      button(
        'Run simulation',
        'simulation',
        true
      )
    ) + `
      <div class="grid kpis">
        ${tile(
          'Total revenue',
          short(s.revenue),
          p.months + ' months'
        )}

        ${tile(
          'Profit before tax',
          short(s.profit),
          'Includes interest'
        )}

        ${tile(
          'Closing cash',
          short(s.cash),
          'After inventory and debt payments'
        )}

        ${tile(
          'Ending inventory',
          short(s.inventory),
          'At modelled average cost'
        )}
      </div>

      <div class="grid two">
        <section class="card pad">
          <h2>Projected cash balance</h2>
          ${chart(rows, 'cash')}
        </section>

        <section class="card pad">
          <h2>Current business</h2>

          <p>
            <b>
              ${escape(categories[p.category].label)}
            </b>
          </p>

          <p class="hint">
            📍 ${escape(p.area || p.city)}, Nigeria
          </p>

          <p class="hint">
            Capital: ${money(p.capital)}
          </p>

          <p class="hint">
            Sales demand:
            ${p.dailyDemand} units/day
          </p>

          <p class="hint">
            Opening stock:
            ${p.openingUnits} units
          </p>

          <div class="notice warning">
            Model results are estimates.
            No actual company records or live
            official Nigerian prices are preloaded.
          </div>
        </section>
      </div>
    `;
  }

  // ---------------------------------------
  // BUSINESS SETUP PAGE
  // ---------------------------------------

  function setup() {
    return heading(
      'Business setup',
      'Edit the parameters used for every monthly simulation.',
      button(
        'View simulation',
        'simulation',
        true
      )
    ) + `
      <div class="grid two">
        <div class="stack">

          ${block(
            '1. Business identity & location',
            [
              field('Business name', 'name', 'text'),

              select(
                'Retail category',
                'category',
                Object.entries(categories).map(
                  ([id, item]) => [
                    id,
                    item.label
                  ]
                )
              ),

              field('City', 'city', 'text'),
              field('Neighbourhood', 'area', 'text'),
              field('Starting month', 'start', 'month'),

              select(
                'Forecast length',
                'months',
                [
                  [12, '12 months'],
                  [24, '24 months'],
                  [36, '36 months']
                ]
              )
            ]
          )}

          ${block(
            '2. Starting finances',
            [
              field('Owner capital (₦)', 'capital'),
              field('Loan received (₦)', 'loan'),
              field('Annual loan interest (%)', 'annualInterest'),
              field('Loan term (months)', 'loanTerm'),
              field(
                'Startup costs excluding opening stock (₦)',
                'setupCost'
              )
            ]
          )}

          ${block(
            '3. Sales & inventory',
            [
              field('Average selling price (₦)', 'price'),
              field('Purchase cost per unit (₦)', 'unitCost'),
              field('Demand per day (units)', 'dailyDemand'),
              field(
                'Maximum capacity per day (units)',
                'dailyCapacity'
              ),
              field('Operating days per month', 'openDays'),
              field('Opening inventory (units)', 'openingUnits'),
              field(
                'Stock purchased monthly (units)',
                'monthlyPurchases'
              ),
              field('Monthly inventory loss (%)', 'shrinkage')
            ]
          )}

          ${block(
            '4. Fixed monthly expenses',
            [
              field('Rent (₦)', 'rent'),
              field('Staff salaries (₦)', 'salaries'),
              field(
                'Electricity and power (₦)',
                'electricity'
              ),
              field('Other expenses (₦)', 'otherCosts')
            ]
          )}

          ${block(
            '5. Economic exposure',
            [
              field(
                'Fallback annual inflation (%)',
                'annualInflation'
              ),
              field(
                'Monthly demand growth (%)',
                'demandGrowth'
              ),
              field(
                'Monthly selling-price growth (%)',
                'priceGrowth'
              ),
              field(
                'FX-sensitive share of purchases (%)',
                'fxShare'
              ),
              field(
                'Fuel-sensitive share of purchases (%)',
                'fuelShare'
              )
            ]
          )}
        </div>

        <aside class="card pad">
          <h2>What these inputs mean</h2>

          <p class="hint">
            Sales are limited by demand,
            capacity and available inventory.
            Purchasing stock reduces cash;
            only stock sold or lost is charged
            to profit.
          </p>

          <div class="notice">
            Changes are saved as a draft in
            this browser. Go to
            <b>Simulation</b> to see
            updated projections.
          </div>

          <div class="notice warning">
            The default numbers are illustrative.
            Historical data is optional and
            must be sourced and verified separately.
          </div>
        </aside>
      </div>
    `;
  }

  // ---------------------------------------
  // SIMULATION RESULTS PAGE
  // ---------------------------------------

  function simulation() {
    const rows = simulate();
    const s = summary(rows);

    return heading(
      'Simulation results',
      'Monthly modelled income, costs, inventory and cash flow.',
      '<button class="btn" id="exportCSV">Export CSV</button>'
    ) + `
      <div class="grid kpis">
        ${tile('Revenue', short(s.revenue))}
        ${tile('Profit before tax', short(s.profit))}
        ${tile('Closing cash', short(s.cash))}
        ${tile(
          'Missed sales (units)',
          Math.round(s.missed).toLocaleString()
        )}
      </div>

      <section class="card pad">
        <div class="inline">
          <h2>Financial trend</h2>

          <div class="actions">
            ${['cash', 'sales', 'profit'].map(
              k => `
                <button
                  class="btn"
                  data-metric="${k}">
                  ${k}
                </button>
              `
            ).join('')}
          </div>
        </div>

        ${chart(rows, chartMetric)}
      </section>

      <section class="card pad section-gap">
        <h2>Monthly financial report</h2>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                ${[
                  'Month',
                  'Revenue',
                  'COGS',
                  'Overhead',
                  'Loan interest',
                  'Profit',
                  'Closing cash',
                  'Units in stock',
                  'Missed units'
                ].map(
                  h => `<th>${h}</th>`
                ).join('')}
              </tr>
            </thead>

            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${r.month}</td>
                  <td>${money(r.sales)}</td>
                  <td>${money(r.costOfSales)}</td>
                  <td>${money(r.expenses)}</td>
                  <td>${money(r.interest)}</td>
                  <td>${money(r.profit)}</td>
                  <td>${money(r.cash)}</td>
                  <td>${Math.round(r.stock)}</td>
                  <td>${Math.round(r.missed)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <p class="hint">
          Simplifications: immediate payment
          for sales and purchases; no taxes,
          depreciation, accounts receivable,
          or supplier credit yet.
        </p>
      </section>
    `;
  }

  // ---------------------------------------
  // SCENARIOS PAGE
  // ---------------------------------------

  function scenariosPage() {
    const base = simulate();
    const alt = simulate(p, scenario);

    const b = summary(base);
    const a = summary(alt);

    return heading(
      'What-if scenarios',
      'Compare the business with alternative assumptions.'
    ) + `
      <div class="scenarios">
        ${Object.entries(cases).map(
          ([id, item]) => `
            <button
              class="scenario ${scenario === id ? 'selected' : ''}"
              data-scenario="${id}">

              <strong>${item.label}</strong>
              <p>${item.detail}</p>
            </button>
          `
        ).join('')}
      </div>

      ${scenario === 'custom' ? `
        <section class="card pad section-gap">
          <h2>Custom changes</h2>

          <div class="form">
            ${[
              ['demand', 'Change demand (%)'],
              ['cost', 'Change purchase costs (%)'],
              ['price', 'Change sale prices (%)'],
              ['fixed', 'Change fixed expenses (%)'],
              ['month', 'Start at month']
            ].map(
              ([key, label]) => `
                <div class="field">
                  <label>${label}</label>

                  <input
                    data-custom="${key}"
                    type="number"
                    step="any"
                    value="${p.custom[key]}">
                </div>
              `
            ).join('')}
          </div>
        </section>
      ` : ''}

      <div class="grid kpis section-gap">
        ${tile('Base profit', short(b.profit))}
        ${tile('Scenario profit', short(a.profit))}
        ${tile('Base cash', short(b.cash))}
        ${tile('Scenario cash', short(a.cash))}
      </div>

      <section class="card pad">
        <h2>Cash comparison</h2>

        ${chart(base, 'cash', alt)}

        <p class="hint">
          Change in total profit:
          <b>
            ${money(a.profit - b.profit)}
          </b>
        </p>
      </section>
    `;
  }

  // ---------------------------------------
  // ECONOMIC DATA PAGE
  // ---------------------------------------

  function economicData() {
    const s = DB.status();

    return heading(
      'Economic data',
      'Load annual inflation or import verified historical monthly observations.'
    ) + `
      <div class="grid two">
        <div class="stack">

          <section class="card pad">
            <h2>World Bank annual CPI inflation</h2>

            <p class="hint">
              Fetch Nigeria's annual inflation
              series from the World Bank.
              When used for monthly projections
              it is converted to a monthly-equivalent
              estimate, not treated as observed
              monthly inflation.
            </p>

            <button
              class="btn primary"
              id="fetchWB">
              Fetch annual inflation
            </button>

            <p class="hint">
              Annual observations cached:
              ${s.years}
            </p>
          </section>

          <section class="card pad">
            <h2>Import historical monthly CSV</h2>

            <p class="hint">
              Paste CSV with columns:
              <code>metric,month,value,source</code>.
              Accepted metrics:
              <code>cpi_mom</code>,
              <code>cpi_yoy</code>,
              <code>fx_ngn_usd</code>,
              <code>petrol_ngn_litre</code>.
            </p>

            <div class="field">
              <textarea
                id="csvInput"
                placeholder="metric,month,value,source&#10;petrol_ngn_litre,2023-01,REPLACE_WITH_REAL_VALUE,NBS"></textarea>
            </div>

            <div class="actions section-gap">
              <button
                class="btn primary"
                id="importCSV">
                Import CSV
              </button>

              <button
                class="btn danger"
                id="clearData">
                Clear monthly records
              </button>
            </div>
          </section>
        </div>

        <section class="card pad">
          <h2>Data status</h2>

          <p>
            Monthly records loaded:
            <b>${s.records}</b>
          </p>

          <p>
            Annual CPI observations:
            <b>${s.years}</b>
          </p>

          <div class="notice warning">
            User-imported values are not
            independently verified.
            Missing FX or petrol observations
            do not trigger estimated historical
            shocks; the model flags them in
            its calculations.
          </div>
        </section>
      </div>
    `;
  }

  // ---------------------------------------
  // SAVED PROJECTS PAGE
  // ---------------------------------------

  function saved() {
    const items = read(SAVE_KEY, []);

    return heading(
      'Saved projects',
      'Stored in this browser only; not synchronised to GitHub or other devices.',
      '<button class="btn primary" id="newProject">New project</button>'
    ) + `
      <section class="card pad">
        <h2>Saved businesses (${items.length})</h2>

        <div class="stack">
          ${items.length
            ? items.map(
                (r, i) => `
                  <div class="saved-item">
                    <div>
                      <b>${escape(r.name)}</b>

                      <small>
                        ${escape(
                          categories[r.category]?.label ||
                          'Retail'
                        )}
                        • ${escape(r.city)}
                      </small>
                    </div>

                    <div class="actions">
                      <button
                        class="btn"
                        data-open="${i}">
                        Open
                      </button>

                      <button
                        class="btn danger"
                        data-remove="${i}">
                        Delete
                      </button>
                    </div>
                  </div>
                `
              ).join('')
            : `
              <p class="hint">
                Nothing saved yet.
                Click Save project in the top bar.
              </p>
            `}
        </div>
      </section>
    `;
  }

  // ---------------------------------------
  // RENDERING AND NAVIGATION
  // ---------------------------------------

  const views = {
    dashboard,
    setup,
    simulation,
    scenarios: scenariosPage,
    data: economicData,
    saved
  };

  function render() {
    $('pageTitle').textContent =
      names[page];

    document.querySelectorAll(
      '[data-page]'
    ).forEach(
      btn => btn.classList.toggle(
        'active',
        btn.dataset.page === page
      )
    );

    $('content').innerHTML =
      views[page]();
  }

  function saveProject() {
    const items = read(SAVE_KEY, []);

    p.id ||= String(Date.now());

    const at = items.findIndex(
      r => r.id === p.id
    );

    if (at === -1) {
      items.unshift(
        structuredClone(p)
      );
    } else {
      items[at] =
        structuredClone(p);
    }

    store(SAVE_KEY, items);
    store(DRAFT_KEY, p);

    toast(
      'Project saved in this browser'
    );
  }

  function downloadCSV() {
    const rows = simulate();

    const keys = [
      'month',
      'sales',
      'costOfSales',
      'expenses',
      'interest',
      'profit',
      'cash',
      'purchaseCash',
      'stock',
      'inventoryValue',
      'sold',
      'missed',
      'debt',
      'cpiStatus'
    ];

    const csv = [
      keys.join(','),
      ...rows.map(
        r => keys.map(
          k => r[k]
        ).join(',')
      )
    ].join('\n');

    const url = URL.createObjectURL(
      new Blob(
        [csv],
        { type: 'text/csv' }
      )
    );

    const a = document.createElement('a');

    a.href = url;
    a.download =
      'simvest-retail-simulation.csv';

    a.click();

    setTimeout(
      () => URL.revokeObjectURL(url),
      1000
    );
  }

  // ---------------------------------------
  // EVENT LISTENERS
  // ---------------------------------------

  $('navigation').addEventListener(
    'click',
    event => {
      const btn = event.target.closest(
        '[data-page]'
      );

      if (!btn) return;

      page = btn.dataset.page;

      $('sidebar').classList.remove(
        'open'
      );

      render();
    }
  );

  $('menuButton').addEventListener(
    'click',
    () => $('sidebar').classList.toggle(
      'open'
    )
  );

  $('saveButton').addEventListener(
    'click',
    saveProject
  );

  $('content').addEventListener(
    'change',
    event => {
      const input = event.target;

      if (input.dataset.key) {
        const key = input.dataset.key;

        const value =
          input.type === 'number'
            ? Number(input.value)
            : input.value;

        if (key === 'category') {
          const c = categories[value];

          Object.assign(
            p,
            {
              category: value,
              price: c.price,
              unitCost: c.cost,
              dailyDemand: c.demand,
              dailyCapacity: c.capacity,
              openingUnits: c.stock,
              monthlyPurchases: c.buy
            }
          );

          render();
        } else {
          p[key] = value;
        }

        store(DRAFT_KEY, p);
      }

      if (input.dataset.custom) {
        p.custom[input.dataset.custom] =
          Number(input.value);

        store(DRAFT_KEY, p);
        render();
      }
    }
  );

  $('content').addEventListener(
    'click',
    async event => {
      const btn = event.target.closest(
        'button'
      );

      if (!btn) return;

      if (btn.dataset.goto) {
        page = btn.dataset.goto;
        render();

      } else if (btn.dataset.metric) {
        chartMetric = btn.dataset.metric;
        render();

      } else if (btn.dataset.scenario) {
        scenario = btn.dataset.scenario;
        render();

      } else if (btn.id === 'exportCSV') {
        downloadCSV();

      } else if (btn.id === 'fetchWB') {
        btn.disabled = true;
        btn.textContent = 'Fetching…';

        try {
          const count =
            await DB.fetchWorldBank();

          toast(
            'Loaded ' +
            count +
            ' annual observations'
          );

          render();

        } catch (err) {
          toast(
            'Unable to fetch: ' +
            err.message
          );

          btn.disabled = false;
          btn.textContent =
            'Fetch annual inflation';
        }

      } else if (btn.id === 'importCSV') {
        try {
          const count = DB.importCSV(
            $('csvInput').value
          );

          toast(
            'Imported ' +
            count +
            ' observations'
          );

          render();

        } catch (err) {
          toast(err.message);
        }

      } else if (btn.id === 'clearData') {
        if (confirm(
          'Delete all imported monthly economic records?'
        )) {
          DB.clear();
          render();
        }

      } else if (btn.id === 'newProject') {
        p = structuredClone(defaults);

        store(DRAFT_KEY, p);

        page = 'setup';
        render();

      } else if (
        btn.dataset.open !== undefined
      ) {
        const item = read(
          SAVE_KEY,
          []
        )[Number(btn.dataset.open)];

        if (item) {
          p = {
            ...defaults,
            ...item,
            custom: {
              ...defaults.custom,
              ...item.custom
            }
          };

          store(DRAFT_KEY, p);

          page = 'dashboard';
          render();
        }

      } else if (
        btn.dataset.remove !== undefined &&
        confirm('Delete this project?')
      ) {
        const items = read(
          SAVE_KEY,
          []
        );

        items.splice(
          Number(btn.dataset.remove),
          1
        );

        store(SAVE_KEY, items);
        render();
      }
    }
  );

  // Start SimVest
  render();

})();
