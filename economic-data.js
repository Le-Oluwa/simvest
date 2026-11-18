
/*
  SIMVEST ECONOMIC DATA ENGINE
  Version 0.5

  Handles:
  - Nigerian annual inflation data
  - Historical monthly economic records
  - Exchange-rate changes
  - Petrol-price changes
  - CSV data imports
  - Browser storage

  Historical data must come from verified sources.
*/

window.SimVestData = (() => {
  "use strict";

  const STORAGE_KEY = "simvest_economic_v05";

  const ALLOWED_METRICS = new Set([
    "cpi_mom",
    "cpi_yoy",
    "fx_ngn_usd",
    "petrol_ngn_litre"
  ]);

  // ----------------------------
  // DATABASE INITIALISATION
  // ----------------------------

  let state = {
    records: [],
    annual: {}
  };

  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    if (saved && typeof saved === "object") {
      state.records = Array.isArray(saved.records)
        ? saved.records
        : [];

      state.annual =
        saved.annual &&
        typeof saved.annual === "object"
          ? saved.annual
          : {};
    }
  } catch (error) {
    console.warn(
      "SimVest economic storage unavailable:",
      error
    );
  }

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.warn(
        "Unable to save economic data:",
        error
      );
    }
  }

  // ----------------------------
  // DATE UTILITIES
  // ----------------------------

  function validMonth(month) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(
      month
    );
  }

  function previousMonth(month) {
    const [year, monthNumber] =
      month.split("-").map(Number);

    return new Date(
      Date.UTC(year, monthNumber - 2, 1)
    ).toISOString().slice(0, 7);
  }

  // ----------------------------
  // RETRIEVE ECONOMIC RECORDS
  // ----------------------------

  function get(metric, month) {
    const record = state.records.find(
      item =>
        item.metric === metric &&
        item.month === month
    );

    return record?.value;
  }

  // ----------------------------
  // CALCULATE ECONOMIC CHANGES
  // ----------------------------

  function changes(
    month,
    fallbackAnnualPct = 0,
    fxShare = 0,
    fuelShare = 0
  ) {
    const monthlyInflation = get(
      "cpi_mom",
      month
    );

    const yearlyInflation =
      get("cpi_yoy", month) ??
      state.annual[month.slice(0, 4)];

    let inflation;
    let cpiStatus;

    if (monthlyInflation !== undefined) {
      inflation = monthlyInflation / 100;

      cpiStatus = "monthly observation";

    } else if (
      yearlyInflation !== undefined
    ) {
      inflation =
        Math.pow(
          1 + Math.max(
            -95,
            yearlyInflation
          ) / 100,
          1 / 12
        ) - 1;

      cpiStatus = "annual-equivalent estimate";

    } else {
      inflation =
        Math.pow(
          1 + Math.max(
            -95,
            Number(fallbackAnnualPct) || 0
          ) / 100,
          1 / 12
        ) - 1;

      cpiStatus = "manual assumption";
    }

    // Calculate a change between
    // two consecutive monthly observations.

    function monthlyChange(metric) {
      const current = get(metric, month);

      const previous = get(
        metric,
        previousMonth(month)
      );

      if (
        current === undefined ||
        previous === undefined ||
        current <= 0 ||
        previous <= 0
      ) {
        return null;
      }

      return current / previous - 1;
    }

    const fxChange = monthlyChange(
      "fx_ngn_usd"
    );

    const fuelChange = monthlyChange(
      "petrol_ngn_litre"
    );

    // Allocation of procurement exposure

    const fxWeight = Math.min(
      1,
      Math.max(
        0,
        Number(fxShare) / 100 || 0
      )
    );

    const fuelWeight = Math.min(
      1 - fxWeight,
      Math.max(
        0,
        Number(fuelShare) / 100 || 0
      )
    );

    const remainingWeight =
      1 - fxWeight - fuelWeight;

    // Simplified procurement-cost model

    const procurementFactor = Math.max(
      0.1,
      1 +
        remainingWeight * inflation +
        fxWeight * (fxChange ?? 0) +
        fuelWeight * (fuelChange ?? 0)
    );

    const fixedFactor = Math.max(
      0.1,
      1 + inflation
    );

    return {
      inflation,
      procurementFactor,
      fixedFactor,

      fxChange,
      fuelChange,

      cpiStatus,

      fxStatus:
        fxChange === null
          ? "missing: no FX shock applied"
          : "historical change applied",

      fuelStatus:
        fuelChange === null
          ? "missing: no fuel shock applied"
          : "historical change applied"
    };
  }

  // ----------------------------
  // CSV IMPORT SYSTEM
  // ----------------------------

  function importCSV(csvText) {
    if (
      typeof csvText !== "string" ||
      !csvText.trim()
    ) {
      throw new Error(
        "Please paste valid CSV data."
      );
    }

    const lines = csvText
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    const headers = lines
      .shift()
      .split(",")
      .map(
        item => item.trim().toLowerCase()
      );

    const required = [
      "metric",
      "month",
      "value",
      "source"
    ];

    for (const column of required) {
      if (!headers.includes(column)) {
        throw new Error(
          "Missing CSV column: " + column
        );
      }
    }

    if (lines.length > 5000) {
      throw new Error(
        "Maximum 5,000 rows per import."
      );
    }

    const records = [];

    lines.forEach((line, index) => {
      const values = line
        .split(",")
        .map(item => item.trim());

      if (values.length !== headers.length) {
        throw new Error(
          "Invalid CSV row " + (index + 2)
        );
      }

      const row = {};

      headers.forEach((header, i) => {
        row[header] = values[i];
      });

      const value = Number(row.value);

      if (
        !ALLOWED_METRICS.has(row.metric) ||
        !validMonth(row.month) ||
        row.value === "" ||
        !Number.isFinite(value) ||
        !row.source
      ) {
        throw new Error(
          "Invalid data at row " + (index + 2)
        );
      }

      if (
        (
          row.metric === "fx_ngn_usd" ||
          row.metric === "petrol_ngn_litre"
        ) &&
        value <= 0
      ) {
        throw new Error(
          "Price must be positive at row " +
          (index + 2)
        );
      }

      records.push({
        metric: row.metric,
        month: row.month,
        value,
        source: row.source
      });
    });

    const merged = new Map();

    state.records.forEach(record => {
      merged.set(
        record.metric + "|" + record.month,
        record
      );
    });

    records.forEach(record => {
      merged.set(
        record.metric + "|" + record.month,
        record
      );
    });

    state.records = [...merged.values()]
      .sort(
        (a, b) =>
          a.month.localeCompare(b.month)
      );

    save();

    return records.length;
  }

  // ----------------------------
  // WORLD BANK API
  // ----------------------------

  async function fetchWorldBank() {
    const endpoint =
      "https://api.worldbank.org/v2/country/NG/indicator/FP.CPI.TOTL.ZG?format=json&per_page=150";

    const response = await fetch(endpoint);

    if (!response.ok) {
      throw new Error(
        "World Bank API error: " +
        response.status
      );
    }

    const json = await response.json();

    if (!Array.isArray(json[1])) {
      throw new Error(
        "Unexpected World Bank response"
      );
    }

    const annual = {};

    for (const row of json[1]) {
      if (
        row.value !== null &&
        Number.isFinite(Number(row.value))
      ) {
        annual[row.date] = Number(
          row.value
        );
      }
    }

    state.annual = annual;

    save();

    return Object.keys(annual).length;
  }

  // ----------------------------
  // DATA MANAGEMENT
  // ----------------------------

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

  // ----------------------------
  // PUBLIC API
  // ----------------------------

  return {
    get,
    changes,
    importCSV,
    fetchWorldBank,
    clear,
    status
  };

})();
