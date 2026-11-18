
/* SimVest economic data v0.5
   User imports are NOT independently verified.
*/

window.SimVestData = (() => {
  'use strict';

  const KEY = 'simvest_economic_v05';
  const ALLOWED = new Set([
    'cpi_mom',
    'cpi_yoy',
    'fx_ngn_usd',
    'petrol_ngn_litre'
  ]);

  let state;

  try {
    state = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    state = {};
  }

  state.records = Array.isArray(state.records)
    ? state.records
    : [];

  state.annual = state.annual &&
    typeof state.annual === 'object'
    ? state.annual
    : {};

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  };

  const validMonth = m =>
    /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

  function get(metric, month) {
    return state.records.find(
      r => r.metric === metric && r.month === month
    )?.value;
  }

  function previous(month) {
    const [y, m] = month.split('-').map(Number);
    return new Date(
      Date.UTC(y, m - 2, 1)
    ).toISOString().slice(0, 7);
  }

  function changes(
    month,
    fallbackAnnualPct,
    fxShare = 0,
    fuelShare = 0
  ) {
    const monthly = get('cpi_mom', month);

    const annual =
      get('cpi_yoy', month) ??
      state.annual[month.slice(0, 4)];

    const inflation = monthly !== undefined
      ? monthly / 100
      : Math.pow(
          1 + Math.max(
            -95,
            annual ?? fallbackAnnualPct
          ) / 100,
          1 / 12
        ) - 1;

    function ratio(metric) {
      const now = get(metric, month);
      const prior = get(metric, previous(month));

      return now > 0 && prior > 0
        ? now / prior - 1
        : null;
    }

    const fx = ratio('fx_ngn_usd');
    const fuel = ratio('petrol_ngn_litre');

    const fxWeight = Math.min(
      1,
      Math.max(0, fxShare / 100)
    );

    const fuelWeight = Math.min(
      1 - fxWeight,
      Math.max(0, fuelShare / 100)
    );

    const otherWeight =
      1 - fxWeight - fuelWeight;

    const procurementFactor = Math.max(
      0.1,
      1 +
        otherWeight * inflation +
        fxWeight * (fx ?? 0) +
        fuelWeight * (fuel ?? 0)
    );

    return {
      inflation,
      procurementFactor,
      fixedFactor: Math.max(
        0.1,
        1 + inflation
      ),

      cpiStatus:
        monthly !== undefined
          ? 'monthly observation'
          : annual !== undefined
          ? 'annual-equivalent estimate'
          : 'manual assumption',

      fxStatus:
        fx === null
          ? 'missing: no FX shock applied'
          : 'historical change applied',

      fuelStatus:
        fuel === null
          ? 'missing: no fuel shock applied'
          : 'historical change applied'
    };
  }

  function importCSV(csv) {
    const lines = csv.trim()
      .split(/\r?\n/)
      .filter(Boolean);

    const headers = lines.shift()
      .split(',')
      .map(x => x.trim().toLowerCase());

    for (const h of [
      'metric',
      'month',
      'value',
      'source'
    ]) {
      if (!headers.includes(h)) {
        throw Error('Missing CSV column: ' + h);
      }
    }

    if (lines.length > 5000) {
      throw Error('Import no more than 5,000 rows at once');
    }

    const incoming = lines.map((line, i) => {
      const values = line.split(',')
        .map(x => x.trim());

      if (values.length !== headers.length) {
        throw Error('Invalid CSV at row ' + (i + 2));
      }

      const raw = Object.fromEntries(
        headers.map((h, j) => [h, values[j]])
      );

      const value = Number(raw.value);

      if (
        !ALLOWED.has(raw.metric) ||
        !validMonth(raw.month) ||
        raw.value === '' ||
        !Number.isFinite(value) ||
        !raw.source
      ) {
        throw Error('Invalid data on row ' + (i + 2));
      }

      if (
        ['fx_ngn_usd', 'petrol_ngn_litre']
          .includes(raw.metric) &&
        value <= 0
      ) {
        throw Error(
          'Prices must be positive (row ' + (i + 2) + ')'
        );
      }

      return {
        metric: raw.metric,
        month: raw.month,
        value,
        source: raw.source
      };
    });

    const merged = new Map(
      state.records.map(r => [
        r.metric + '|' + r.month,
        r
      ])
    );

    for (const r of incoming) {
      merged.set(r.metric + '|' + r.month, r);
    }

    state.records = [...merged.values()].sort(
      (a, b) => a.month.localeCompare(b.month)
    );

    save();
    return incoming.length;
  }

  async function fetchWorldBank() {
    const url =
      'https://api.worldbank.org/v2/country/NG/indicator/FP.CPI.TOTL.ZG?format=json&per_page=150';

    const response = await fetch(url);

    if (!response.ok) {
      throw Error(
        'World Bank API responded with ' +
        response.status
      );
    }

    const json = await response.json();

    if (!Array.isArray(json[1])) {
      throw Error('Unexpected World Bank response');
    }

    const annual = {};

    for (const row of json[1]) {
      if (
        row.value !== null &&
        Number.isFinite(Number(row.value))
      ) {
        annual[row.date] = Number(row.value);
      }
    }

    state.annual = annual;
    save();

    return Object.keys(annual).length;
  }

  function clear() {
    state.records = [];
    save();
  }

  function status() {
    return {
      records: state.records.length,
      years: Object.keys(state.annual).length
    };
  }

  return {
    get,
    changes,
    importCSV,
    fetchWorldBank,
    clear,
    status
  };
})();
