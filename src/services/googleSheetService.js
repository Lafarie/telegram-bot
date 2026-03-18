const logger = require('../utils/logger');

class GoogleSheetService {
  constructor(options = {}) {
    this.sheetUrl = options.sheetUrl || process.env.GOOGLE_SHEET_URL || '';
    this.maxRows = Number(options.maxRows || process.env.GOOGLE_SHEET_MAX_ROWS || 120);
    this.maxColumns = Number(options.maxColumns || process.env.GOOGLE_SHEET_MAX_COLUMNS || 20);
    this.timeoutMs = Number(options.timeoutMs || process.env.GOOGLE_SHEET_TIMEOUT_MS || 15000);
  }

  getConfigured() {
    return Boolean(this.sheetUrl);
  }

  async getPromptContext() {
    return this.getFilteredPromptContext({});
  }

  async getFilteredPromptContext(filters = {}) {
    const table = await this.getTabularData();
    const headerMap = this.resolveHeaderMap(table.headers);
    const rowObjects = this.toRowObjects(table.headers, table.rows);
    const filteredRows = this.applyFilters(rowObjects, filters, headerMap);
    const sortedRows = this.sortRows(filteredRows, filters, headerMap, table.headers);

    const limit = this.getSafeLimit(filters.limit);
    const limitedRows = sortedRows.slice(0, limit);
    const outputHeaders = this.resolveOutputHeaders(filters.fields, table.headers, headerMap);

    const lines = [];
    lines.push(`Spreadsheet source: ${this.sheetUrl}`);
    lines.push(`Filters: ${JSON.stringify(filters)}`);
    lines.push(`Columns: ${outputHeaders.join(' | ')}`);
    lines.push(`Rows matched: ${sortedRows.length} of ${rowObjects.length}`);
    lines.push(`Rows returned: ${limitedRows.length}`);
    lines.push('Filtered data sample:');

    for (const row of limitedRows) {
      const values = outputHeaders.map(header => (row[header] || '').toString());
      lines.push(values.join(' | '));
    }

    if (limitedRows.length === 0) {
      lines.push('No rows matched the provided filters.');
    }

    return lines.join('\n');
  }

  getSafeLimit(limit) {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return this.maxRows;
    }
    return Math.min(Math.floor(parsed), this.maxRows);
  }

  resolveHeaderMap(headers) {
    const map = {};
    const normalizedHeaders = headers.map(header => this.normalizeHeader(header));
    const find = patterns => normalizedHeaders.findIndex(header => patterns.some(pattern => pattern.test(header)));

    map.transaction_id = find([/transactionid|transaction_id|id$/]);
    map.date = find([/^date$/, /transactiondate|createdat|time/]);
    map.ticket_category = find([/ticketcategory|category/]);
    map.price = find([/^price$|perticket/]);
    map.quantity = find([/^quantity$|ticketcount|count/]);
    map.total_price = find([/totalprice|amount|total/]);
    map.source = find([/^source$/]);
    map.currency = find([/currency/]);
    map.table_number = find([/tablenumber|table/]);
    map.age = find([/^age$/]);
    map.city = find([/^city$/]);
    map.payment_status = find([/paymentstatus|paymentstatues|status/]);

    return map;
  }

  toRowObjects(headers, rows) {
    return rows.map(row => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = (row[idx] || '').toString().trim();
      });
      return obj;
    });
  }

  applyFilters(rows, filters, headerMap) {
    return rows.filter(row => {
      if (!this.matchValue(row, headerMap, 'transaction_id', filters.transaction_id)) return false;
      if (!this.matchContains(row, headerMap, 'ticket_category', filters.ticket_category)) return false;
      if (!this.matchContains(row, headerMap, 'source', filters.source)) return false;
      if (!this.matchContains(row, headerMap, 'currency', filters.currency)) return false;
      if (!this.matchContains(row, headerMap, 'city', filters.city)) return false;
      if (!this.matchContains(row, headerMap, 'payment_status', filters.payment_status)) return false;
      if (!this.matchDate(row, headerMap, filters.date, filters.date_from, filters.date_to)) return false;
      if (!this.matchNumericRange(row, headerMap, 'total_price', filters.min_total_price, filters.max_total_price)) return false;
      if (!this.matchNumericRange(row, headerMap, 'quantity', filters.min_quantity, filters.max_quantity)) return false;
      return true;
    });
  }

  sortRows(rows, filters, headerMap, headers) {
    if (rows.length <= 1) {
      return rows;
    }

    const sortBy = (filters.sort_by || 'date').toString().toLowerCase();
    const sortOrder = (filters.sort_order || 'desc').toString().toLowerCase() === 'asc' ? 1 : -1;
    const headerIndex = headerMap[sortBy];
    if (typeof headerIndex !== 'number' || headerIndex < 0 || headerIndex >= headers.length) {
      return rows;
    }

    const headerName = headers[headerIndex];
    const sorted = [...rows].sort((a, b) => {
      const av = a[headerName] || '';
      const bv = b[headerName] || '';

      const ad = Date.parse(av);
      const bd = Date.parse(bv);
      if (!Number.isNaN(ad) && !Number.isNaN(bd)) {
        return (ad - bd) * sortOrder;
      }

      const an = this.toNumber(av);
      const bn = this.toNumber(bv);
      if (an !== null && bn !== null) {
        return (an - bn) * sortOrder;
      }

      return av.localeCompare(bv) * sortOrder;
    });

    return sorted;
  }

  resolveOutputHeaders(fields, allHeaders, headerMap) {
    if (!Array.isArray(fields) || fields.length === 0) {
      return allHeaders;
    }

    const selected = [];
    for (const field of fields) {
      const normalizedField = this.normalizeHeader(field);
      const idx = headerMap[normalizedField];

      if (typeof idx === 'number' && idx >= 0 && idx < allHeaders.length) {
        selected.push(allHeaders[idx]);
        continue;
      }

      const direct = allHeaders.find(header => this.normalizeHeader(header) === normalizedField);
      if (direct) {
        selected.push(direct);
      }
    }

    return selected.length > 0 ? selected : allHeaders;
  }

  matchValue(row, headerMap, key, expected) {
    if (expected === undefined || expected === null || expected === '') return true;
    const value = this.getCell(row, headerMap[key]);
    if (value === null) return false;
    return value.toLowerCase() === expected.toString().trim().toLowerCase();
  }

  matchContains(row, headerMap, key, expected) {
    if (expected === undefined || expected === null || expected === '') return true;
    const value = this.getCell(row, headerMap[key]);
    if (value === null) return false;
    return value.toLowerCase().includes(expected.toString().trim().toLowerCase());
  }

  matchDate(row, headerMap, exactDate, fromDate, toDate) {
    if (!exactDate && !fromDate && !toDate) return true;

    const raw = this.getCell(row, headerMap.date);
    if (raw === null) return false;

    const valueMs = Date.parse(raw);
    if (Number.isNaN(valueMs)) return false;

    if (exactDate) {
      const exactMs = Date.parse(exactDate);
      if (!Number.isNaN(exactMs)) {
        const v = new Date(valueMs).toISOString().slice(0, 10);
        const e = new Date(exactMs).toISOString().slice(0, 10);
        if (v !== e) return false;
      }
    }

    if (fromDate) {
      const fromMs = Date.parse(fromDate);
      if (!Number.isNaN(fromMs) && valueMs < fromMs) return false;
    }

    if (toDate) {
      const toMs = Date.parse(toDate);
      if (!Number.isNaN(toMs) && valueMs > toMs) return false;
    }

    return true;
  }

  matchNumericRange(row, headerMap, key, minValue, maxValue) {
    if (minValue === undefined && maxValue === undefined) return true;

    const raw = this.getCell(row, headerMap[key]);
    const value = this.toNumber(raw);
    if (value === null) return false;

    const min = this.toNumber(minValue);
    const max = this.toNumber(maxValue);
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
  }

  getCell(row, index) {
    if (typeof index !== 'number' || index < 0) return null;
    const key = Object.keys(row)[index];
    if (!key) return null;
    return (row[key] || '').toString().trim();
  }

  toNumber(value) {
    if (value === null || value === undefined) return null;
    const normalized = value.toString().replace(/[$,%\s,]/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  normalizeHeader(value) {
    return (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  async getTabularData() {
    if (!this.sheetUrl) {
      throw new Error('GOOGLE_SHEET_URL is not configured.');
    }

    const { spreadsheetId, gid } = this.extractSheetInfo(this.sheetUrl);
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(csvUrl, { method: 'GET', signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch Google Sheet CSV (HTTP ${response.status}). Make sure the sheet is shared for access.`);
      }

      const csvText = await response.text();
      const allRows = this.parseCsv(csvText);
      if (allRows.length === 0) {
        throw new Error('Spreadsheet is empty.');
      }

      const headers = (allRows[0] || []).slice(0, this.maxColumns);
      const dataRows = allRows.slice(1, this.maxRows + 1).map(row => row.slice(0, this.maxColumns));
      return {
        headers,
        rows: dataRows,
        totalRows: Math.max(0, allRows.length - 1)
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  extractSheetInfo(url) {
    const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch) {
      throw new Error('Invalid Google Sheet URL. Could not find spreadsheet ID.');
    }

    const urlObject = new URL(url);
    const gid = urlObject.searchParams.get('gid') || '0';

    return {
      spreadsheetId: idMatch[1],
      gid
    };
  }

  parseCsv(text) {
    const rows = [];
    let row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') {
          i += 1;
        }

        row.push(current.trim());
        current = '';

        if (row.some(cell => cell.length > 0)) {
          rows.push(row);
        }
        row = [];
      } else {
        current += char;
      }
    }

    if (current.length > 0 || row.length > 0) {
      row.push(current.trim());
      if (row.some(cell => cell.length > 0)) {
        rows.push(row);
      }
    }

    return rows;
  }
}

module.exports = GoogleSheetService;
