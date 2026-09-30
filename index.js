(() => {
  'use strict';

  const STORAGE_KEY = 'sql-lab-v1';

  const sampleState = () => ({
    name: 'Playground',
    activeTable: 'customers',
    tables: {
      customers: {
        columns: [
          { name:'id', type:'number' }, { name:'name', type:'text' }, { name:'email', type:'text' },
          { name:'city', type:'text' }, { name:'plan', type:'text' }, { name:'joined_at', type:'date' }
        ],
        rows: [
          { id:1, name:'Ava Brooks', email:'ava@example.com', city:'Boston', plan:'Pro', joined_at:'2026-01-12' },
          { id:2, name:'Noah Carter', email:'noah@example.com', city:'Providence', plan:'Starter', joined_at:'2026-02-03' },
          { id:3, name:'Maya Patel', email:'maya@example.com', city:'New York', plan:'Pro', joined_at:'2026-02-17' },
          { id:4, name:'Eli Walker', email:'eli@example.com', city:'Boston', plan:'Business', joined_at:'2026-03-08' },
          { id:5, name:'Sofia Reed', email:'sofia@example.com', city:'Providence', plan:'Starter', joined_at:'2026-04-22' },
          { id:6, name:'Lucas Kim', email:'lucas@example.com', city:'Chicago', plan:'Pro', joined_at:'2026-05-14' }
        ]
      },
      products: {
        columns: [
          { name:'id', type:'number' }, { name:'name', type:'text' }, { name:'category', type:'text' },
          { name:'price', type:'number' }, { name:'stock', type:'number' }
        ],
        rows: [
          { id:101, name:'Orbit Keyboard', category:'Accessories', price:89, stock:18 },
          { id:102, name:'Arc Mouse', category:'Accessories', price:49, stock:31 },
          { id:103, name:'Studio Display', category:'Displays', price:399, stock:9 },
          { id:104, name:'Dock Mini', category:'Accessories', price:69, stock:22 },
          { id:105, name:'Focus Headphones', category:'Audio', price:159, stock:14 }
        ]
      },
      orders: {
        columns: [
          { name:'id', type:'number' }, { name:'customer_id', type:'number' }, { name:'product_id', type:'number' },
          { name:'quantity', type:'number' }, { name:'status', type:'text' }, { name:'total', type:'number' }, { name:'ordered_at', type:'date' }
        ],
        rows: [
          { id:9001, customer_id:1, product_id:103, quantity:1, status:'Shipped', total:399, ordered_at:'2026-06-01' },
          { id:9002, customer_id:3, product_id:101, quantity:2, status:'Processing', total:178, ordered_at:'2026-06-03' },
          { id:9003, customer_id:2, product_id:102, quantity:1, status:'Delivered', total:49, ordered_at:'2026-06-04' },
          { id:9004, customer_id:4, product_id:105, quantity:1, status:'Delivered', total:159, ordered_at:'2026-06-07' },
          { id:9005, customer_id:1, product_id:104, quantity:2, status:'Processing', total:138, ordered_at:'2026-06-10' },
          { id:9006, customer_id:6, product_id:101, quantity:1, status:'Shipped', total:89, ordered_at:'2026-06-11' },
          { id:9007, customer_id:5, product_id:102, quantity:3, status:'Delivered', total:147, ordered_at:'2026-06-12' }
        ]
      }
    },
    relationships: [
      { from:'orders.customer_id', to:'customers.id' },
      { from:'orders.product_id', to:'products.id' }
    ],
    savedQueries: [
      { id:'starter-pro', name:'Pro customers', sql:"SELECT name, city, plan FROM customers WHERE plan = 'Pro' ORDER BY name ASC;" },
      { id:'starter-orders', name:'Biggest orders', sql:'SELECT id, customer_id, total, status FROM orders ORDER BY total DESC LIMIT 5;' }
    ],
    history: []
  });

  const normalizeState = raw => {
    const base = sampleState();
    if (!raw || typeof raw !== 'object') return base;
    const tables = {};
    for (const [name, table] of Object.entries(raw.tables || {})) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,29}$/.test(name) || !table || !Array.isArray(table.columns) || !Array.isArray(table.rows)) continue;
      const columns = table.columns
        .filter(col => col && /^[A-Za-z_][A-Za-z0-9_]{0,29}$/.test(col.name))
        .map(col => ({ name:col.name, type:['text','number','boolean','date'].includes(col.type) ? col.type : 'text' }));
      if (!columns.length) continue;
      tables[name] = { columns, rows:table.rows.slice(0, 5000).map(row => row && typeof row === 'object' ? row : {}) };
    }
    const next = {
      ...base,
      ...raw,
      tables:Object.keys(tables).length ? tables : base.tables,
      relationships:Array.isArray(raw.relationships) ? raw.relationships.slice(0,50) : base.relationships,
      savedQueries:Array.isArray(raw.savedQueries) ? raw.savedQueries.filter(Boolean).slice(0,30) : base.savedQueries,
      history:Array.isArray(raw.history) ? raw.history.filter(Boolean).slice(0,30) : []
    };
    if (!next.tables[next.activeTable]) next.activeTable = Object.keys(next.tables)[0];
    return next;
  };

  const loadState = () => {
    try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
    catch { return sampleState(); }
  };

  let state = loadState();
  let lastResult = { columns:[], rows:[] };
  let toastTimer = null;

  const $ = id => document.getElementById(id);
  const els = {
    databaseName:$('database-name'), tableCount:$('table-count'), rowCount:$('row-count'), tableList:$('table-list'),
    savedQueryList:$('saved-query-list'), queryHistoryList:$('query-history-list'), queryEditor:$('query-editor'),
    queryContext:$('query-context'), resultSummary:$('result-summary'), resultStatus:$('result-status'),
    resultsTable:$('results-table'), schemaTitle:$('schema-title'), schemaView:$('schema-view'), relationships:$('relationships'),
    builderTable:$('builder-table'), builderColumns:$('builder-columns'), builderFilterColumn:$('builder-filter-column'),
    builderOperator:$('builder-operator'), builderFilterValue:$('builder-filter-value'), builderSortColumn:$('builder-sort-column'),
    builderSortDirection:$('builder-sort-direction'), builderLimit:$('builder-limit'), importFile:$('import-file'),
    tableDialog:$('table-dialog'), newTableName:$('new-table-name'), newTableColumns:$('new-table-columns'),
    rowDialog:$('row-dialog'), rowDialogTitle:$('row-dialog-title'), rowFields:$('row-fields'),
    examplesDialog:$('examples-dialog'), exampleList:$('example-list'), tutorialDialog:$('tutorial-dialog'), toast:$('toast')
  };

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const toast = message => {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  };

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

  const totalRows = () => Object.values(state.tables).reduce((sum, table) => sum + table.rows.length, 0);

  const renderSidebar = () => {
    els.databaseName.textContent = state.name || 'Playground';
    els.tableCount.textContent = Object.keys(state.tables).length;
    els.rowCount.textContent = totalRows();

    els.tableList.innerHTML = Object.entries(state.tables).map(([name, table]) => `
      <button class="table-button ${name === state.activeTable ? 'active' : ''}" type="button" data-table="${escapeHtml(name)}">
        <span><span class="table-icon">▦</span><span>${escapeHtml(name)}</span></span>
        <small>${table.rows.length}</small>
      </button>
    `).join('');

    els.savedQueryList.innerHTML = state.savedQueries.length
      ? state.savedQueries.map(item => `
        <button class="saved-query" type="button" data-saved-query="${escapeHtml(item.id)}">
          <strong>${escapeHtml(item.name || 'Saved query')}</strong>
          <small>${escapeHtml(item.sql)}</small>
        </button>
      `).join('')
      : '<div class="empty-state">No saved queries yet.</div>';

    els.queryHistoryList.innerHTML = state.history.length
      ? state.history.slice(0,8).map(item => `
        <button class="history-query" type="button" data-history-query="${escapeHtml(item.id)}">
          <strong>${escapeHtml(item.sql)}</strong>
          <small>${item.count} rows · ${new Date(item.at).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</small>
        </button>
      `).join('')
      : '<div class="empty-state">Run a query to build history.</div>';
  };

  const renderSchema = () => {
    const table = state.tables[state.activeTable];
    els.schemaTitle.textContent = state.activeTable || 'No table';
    if (!table) {
      els.schemaView.innerHTML = '<div class="empty-state">Create a table to inspect its schema.</div>';
      return;
    }
    els.schemaView.innerHTML = table.columns.map((col, index) => `
      <div class="schema-row">
        <strong>${escapeHtml(col.name)}</strong>
        <span class="type-chip">${escapeHtml(col.type)}</span>
        <span>${index === 0 && col.name === 'id' ? 'primary-style key' : 'column'}</span>
      </div>
    `).join('');
  };

  const renderRelationships = () => {
    const valid = state.relationships.filter(rel => {
      const [fromTable, fromCol] = String(rel.from || '').split('.');
      const [toTable, toCol] = String(rel.to || '').split('.');
      return state.tables[fromTable]?.columns.some(c => c.name === fromCol) &&
        state.tables[toTable]?.columns.some(c => c.name === toCol);
    });
    els.relationships.innerHTML = valid.length
      ? valid.map(rel => `
        <div class="relationship-row">
          <strong>${escapeHtml(rel.from)}</strong><span class="arrow">→</span><strong>${escapeHtml(rel.to)}</strong>
        </div>
      `).join('')
      : '<div class="empty-state">No declared relationships yet. Joins still work when matching columns exist.</div>';
  };

  const renderBuilder = () => {
    const names = Object.keys(state.tables);
    const previousTable = els.builderTable.value;
    els.builderTable.innerHTML = names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    els.builderTable.value = state.tables[previousTable] ? previousTable : (state.activeTable || names[0] || '');
    const table = state.tables[els.builderTable.value];
    const columns = table?.columns || [];
    const options = columns.map(col => `<option value="${escapeHtml(col.name)}">${escapeHtml(col.name)}</option>`).join('');
    els.builderFilterColumn.innerHTML = '<option value="">No filter</option>' + options;
    els.builderSortColumn.innerHTML = '<option value="">No sort</option>' + options;
  };

  const renderAll = () => {
    renderSidebar();
    renderSchema();
    renderRelationships();
    renderBuilder();
    els.queryContext.textContent = state.activeTable || 'No table';
  };

  const chooseTable = name => {
    if (!state.tables[name]) return;
    state.activeTable = name;
    els.queryEditor.value = `SELECT * FROM ${name};`;
    save();
    renderAll();
    runQuery();
  };

  const splitCSV = input => {
    const parts = [];
    let current = '', quote = null, depth = 0;
    for (let i=0;i<input.length;i++) {
      const ch = input[i];
      if (quote) {
        current += ch;
        if (ch === quote && input[i-1] !== '\\') quote = null;
        continue;
      }
      if (ch === "'" || ch === '"') { quote = ch; current += ch; continue; }
      if (ch === '(') depth++;
      if (ch === ')') depth = Math.max(0, depth-1);
      if (ch === ',' && depth === 0) { parts.push(current.trim()); current=''; continue; }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  };

  const stripQuotes = value => {
    const text = String(value ?? '').trim();
    if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
      return text.slice(1,-1).replace(/\\(['"])/g,'$1');
    }
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
    if (/^(true|false)$/i.test(text)) return text.toLowerCase() === 'true';
    if (/^null$/i.test(text)) return null;
    return text;
  };

  const fieldValue = (row, field) => {
    const key = String(field || '').trim();
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    const short = key.includes('.') ? key.split('.').pop() : key;
    return row[short];
  };

  const compare = (left, operator, right) => {
    if (operator.toUpperCase() === 'LIKE') {
      const escaped = String(right ?? '').replace(/[.*+?^$()|[\]\\]/g,'\\$&').replaceAll('%','.*').replaceAll('_','.');
      return new RegExp(`^${escaped}$`,'i').test(String(left ?? ''));
    }
    const a = typeof left === 'number' ? left : (Number.isFinite(Number(left)) && left !== '' ? Number(left) : left);
    const b = typeof right === 'number' ? right : (Number.isFinite(Number(right)) && right !== '' ? Number(right) : right);
    if (operator === '=') return a == b;
    if (operator === '!=') return a != b;
    if (operator === '>') return a > b;
    if (operator === '>=') return a >= b;
    if (operator === '<') return a < b;
    if (operator === '<=') return a <= b;
    return false;
  };

  const applyWhere = (rows, clause) => {
    if (!clause) return rows;
    const conditions = clause.split(/\s+AND\s+/i).map(text => text.trim()).filter(Boolean);
    return rows.filter(row => conditions.every(condition => {
      const match = condition.match(/^([A-Za-z_][\w.]*?)\s*(LIKE|>=|<=|!=|=|>|<)\s*(.+)$/i);
      if (!match) throw new Error(`Unsupported WHERE condition: ${condition}`);
      return compare(fieldValue(row, match[1]), match[2], stripQuotes(match[3]));
    }));
  };

  const qualifyRows = (tableName, rows) => rows.map(row => {
    const record = { ...row };
    for (const [key,value] of Object.entries(row)) record[`${tableName}.${key}`] = value;
    return record;
  });

  const expressionMeta = expression => {
    const aliasMatch = expression.match(/^(.*?)(?:\s+AS\s+([A-Za-z_][\w]*))$/i);
    const raw = (aliasMatch ? aliasMatch[1] : expression).trim();
    const alias = aliasMatch?.[2] || null;
    const aggregate = raw.match(/^(COUNT|SUM|AVG)\s*\(\s*(\*|[A-Za-z_][\w.]*)\s*\)$/i);
    return { raw, alias, aggregate };
  };

  const aggregateValue = (rows, fn, field) => {
    if (fn === 'COUNT') return field === '*' ? rows.length : rows.filter(row => fieldValue(row, field) != null).length;
    const values = rows.map(row => Number(fieldValue(row, field))).filter(Number.isFinite);
    if (fn === 'SUM') return values.reduce((sum,value) => sum + value, 0);
    if (fn === 'AVG') return values.length ? values.reduce((sum,value) => sum + value, 0) / values.length : 0;
    return null;
  };

  const projectRows = (rows, expressions, groupBy) => {
    if (expressions.length === 1 && expressions[0] === '*' && !groupBy) {
      return rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !key.includes('.'))));
    }

    const metas = expressions.map(expressionMeta);
    const hasAggregate = metas.some(meta => meta.aggregate);
    if (!hasAggregate && !groupBy) {
      return rows.map(row => {
        const output = {};
        for (const meta of metas) {
          const key = meta.alias || meta.raw.split('.').pop();
          output[key] = fieldValue(row, meta.raw);
        }
        return output;
      });
    }

    const groups = new Map();
    if (groupBy) {
      for (const row of rows) {
        const key = fieldValue(row, groupBy);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      }
    } else groups.set('__all__', rows);

    return [...groups.entries()].map(([groupKey, groupRows]) => {
      const output = {};
      for (const meta of metas) {
        const key = meta.alias || (meta.aggregate ? `${meta.aggregate[1].toLowerCase()}_${meta.aggregate[2].replace('.','_')}` : meta.raw.split('.').pop());
        if (meta.aggregate) output[key] = aggregateValue(groupRows, meta.aggregate[1].toUpperCase(), meta.aggregate[2]);
        else if (groupBy && meta.raw === groupBy) output[key] = groupKey;
        else output[key] = fieldValue(groupRows[0] || {}, meta.raw);
      }
      return output;
    });
  };

  const executeSelect = sql => {
    const clean = sql.trim().replace(/;\s*$/,'').replace(/\s+/g,' ');
    const head = clean.match(/^SELECT\s+(.+?)\s+FROM\s+([A-Za-z_][\w]*)(.*)$/i);
    if (!head) throw new Error('SQL Lab currently runs SELECT queries. Try SELECT * FROM customers;');

    const selectPart = head[1].trim();
    const baseTable = head[2];
    let rest = head[3] || '';
    const table = state.tables[baseTable];
    if (!table) throw new Error(`Table "${baseTable}" does not exist.`);

    let rows = qualifyRows(baseTable, table.rows);

    const joinMatch = rest.match(/\s+(?:INNER\s+)?JOIN\s+([A-Za-z_][\w]*)\s+ON\s+([A-Za-z_][\w.]*)\s*=\s*([A-Za-z_][\w.]*)/i);
    if (joinMatch) {
      const joinTableName = joinMatch[1];
      const joinTable = state.tables[joinTableName];
      if (!joinTable) throw new Error(`Join table "${joinTableName}" does not exist.`);
      const joined = [];
      const rightRows = qualifyRows(joinTableName, joinTable.rows);
      for (const left of rows) {
        for (const right of rightRows) {
          const merged = { ...left, ...right };
          if (fieldValue(merged, joinMatch[2]) == fieldValue(merged, joinMatch[3])) joined.push(merged);
        }
      }
      rows = joined;
      rest = rest.replace(joinMatch[0], ' ');
    }

    const whereMatch = rest.match(/\s+WHERE\s+(.+?)(?=\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
    const groupMatch = rest.match(/\s+GROUP\s+BY\s+([A-Za-z_][\w.]*)/i);
    const orderMatch = rest.match(/\s+ORDER\s+BY\s+([A-Za-z_][\w.]*)(?:\s+(ASC|DESC))?/i);
    const limitMatch = rest.match(/\s+LIMIT\s+(\d+)/i);

    if (whereMatch) rows = applyWhere(rows, whereMatch[1].trim());

    const expressions = splitCSV(selectPart);
    let projected = projectRows(rows, expressions, groupMatch?.[1] || null);

    if (orderMatch) {
      const field = orderMatch[1];
      const dir = (orderMatch[2] || 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
      projected.sort((a,b) => {
        const av = fieldValue(a, field);
        const bv = fieldValue(b, field);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return (av-bv)*dir;
        return String(av).localeCompare(String(bv), undefined, {numeric:true})*dir;
      });
    }

    if (limitMatch) projected = projected.slice(0, Math.min(500, Number(limitMatch[1])));

    return {
      rows:projected,
      columns:projected.length ? Object.keys(projected[0]) : expressions.map(expression => expressionMeta(expression).alias || expressionMeta(expression).raw.split('.').pop())
    };
  };

  const renderResult = (result, durationMs=0) => {
    lastResult = result;
    els.resultSummary.textContent = `${result.rows.length} row${result.rows.length === 1 ? '' : 's'}`;
    els.resultStatus.textContent = `Query completed in ${durationMs} ms · ${result.columns.length} column${result.columns.length === 1 ? '' : 's'}`;
    els.resultStatus.className = 'result-status success';

    if (!result.columns.length) {
      els.resultsTable.innerHTML = '';
      return;
    }

    els.resultsTable.innerHTML = `
      <thead><tr>${result.columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}</tr></thead>
      <tbody>${result.rows.map(row => `<tr>${result.columns.map(col => {
        const value = row[col];
        return `<td class="${value == null ? 'null' : ''}">${value == null ? 'NULL' : escapeHtml(value)}</td>`;
      }).join('')}</tr>`).join('')}</tbody>
    `;
  };

  const runQuery = () => {
    const sql = els.queryEditor.value.trim();
    if (!sql) return toast('Write a query first.');
    const start = performance.now();
    try {
      const result = executeSelect(sql);
      const duration = Math.max(0, Math.round(performance.now()-start));
      renderResult(result, duration);
      state.history = [{ id:`h-${Date.now()}`, sql, count:result.rows.length, at:Date.now() }, ...state.history.filter(item => item.sql !== sql)].slice(0,30);
      save();
      renderSidebar();
    } catch (error) {
      els.resultSummary.textContent = 'Query error';
      els.resultStatus.textContent = error.message || 'Unable to run query.';
      els.resultStatus.className = 'result-status error';
      toast('Query needs a fix.');
    }
  };

  const formatQuery = () => {
    let sql = els.queryEditor.value.trim().replace(/\s+/g,' ');
    for (const keyword of ['SELECT','FROM','INNER JOIN','JOIN','ON','WHERE','GROUP BY','ORDER BY','LIMIT']) {
      sql = sql.replace(new RegExp(`\\s+${keyword.replace(' ','\\s+')}\\s+`,'ig'), `\n${keyword} `);
    }
    sql = sql.replace(/^select\s+/i,'SELECT ');
    if (sql && !sql.endsWith(';')) sql += ';';
    els.queryEditor.value = sql;
  };

  const applyBuilder = () => {
    const table = els.builderTable.value;
    if (!state.tables[table]) return;
    const columns = els.builderColumns.value.trim() || '*';
    let sql = `SELECT ${columns} FROM ${table}`;
    const filterCol = els.builderFilterColumn.value;
    const filterValue = els.builderFilterValue.value.trim();
    if (filterCol && filterValue) {
      const numeric = /^-?\d+(\.\d+)?$/.test(filterValue);
      const value = numeric ? filterValue : `'${filterValue.replaceAll("'","''")}'`;
      sql += ` WHERE ${filterCol} ${els.builderOperator.value} ${value}`;
    }
    if (els.builderSortColumn.value) sql += ` ORDER BY ${els.builderSortColumn.value} ${els.builderSortDirection.value}`;
    if (els.builderLimit.value) sql += ` LIMIT ${Math.max(1,Math.min(500,Number(els.builderLimit.value)))}`;
    els.queryEditor.value = sql + ';';
    state.activeTable = table;
    save();
    renderAll();
    runQuery();
  };

  const parseColumnDefinition = text => {
    const columns = splitCSV(text).map(part => {
      const [nameRaw,typeRaw='text'] = part.split(':').map(piece => piece.trim());
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,29}$/.test(nameRaw || '')) throw new Error(`Invalid column name: ${nameRaw || '(blank)'}`);
      const type = typeRaw.toLowerCase();
      if (!['text','number','boolean','date'].includes(type)) throw new Error(`Unsupported type: ${type}`);
      return { name:nameRaw, type };
    });
    if (!columns.length) throw new Error('Add at least one column.');
    if (new Set(columns.map(c => c.name)).size !== columns.length) throw new Error('Column names must be unique.');
    return columns;
  };

  const createTable = () => {
    const name = els.newTableName.value.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,29}$/.test(name)) return toast('Use a simple SQL table name.');
    if (state.tables[name]) return toast('That table already exists.');
    try {
      const columns = parseColumnDefinition(els.newTableColumns.value);
      state.tables[name] = { columns, rows:[] };
      state.activeTable = name;
      save();
      els.tableDialog.close();
      els.newTableName.value = '';
      els.newTableColumns.value = '';
      els.queryEditor.value = `SELECT * FROM ${name};`;
      renderAll();
      runQuery();
      toast(`${name} created.`);
    } catch (error) { toast(error.message); }
  };

  const coerceByType = (value, type) => {
    if (value === '') return null;
    if (type === 'number') {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }
    if (type === 'boolean') return value === true || value === 'true';
    return value;
  };

  const openRowDialog = () => {
    const table = state.tables[state.activeTable];
    if (!table) return toast('Choose a table first.');
    els.rowDialogTitle.textContent = `Add row to ${state.activeTable}`;
    els.rowFields.innerHTML = table.columns.map(col => `
      <label>
        <span>${escapeHtml(col.name)} · ${escapeHtml(col.type)}</span>
        ${col.type === 'boolean'
          ? `<select data-row-field="${escapeHtml(col.name)}" data-type="boolean"><option value="">NULL</option><option value="true">true</option><option value="false">false</option></select>`
          : `<input data-row-field="${escapeHtml(col.name)}" data-type="${escapeHtml(col.type)}" ${col.type === 'number' ? 'type="number" step="any"' : col.type === 'date' ? 'type="date"' : 'type="text"'}>`}
      </label>
    `).join('');
    els.rowDialog.showModal();
  };

  const saveRow = () => {
    const table = state.tables[state.activeTable];
    if (!table) return;
    const row = {};
    els.rowFields.querySelectorAll('[data-row-field]').forEach(input => {
      row[input.dataset.rowField] = coerceByType(input.value, input.dataset.type);
    });
    table.rows.push(row);
    save();
    els.rowDialog.close();
    renderAll();
    runQuery();
    toast('Row added.');
  };

  const deleteActiveTable = () => {
    const name = state.activeTable;
    if (!name || !state.tables[name]) return;
    if (!confirm(`Delete table "${name}" and all of its local rows?`)) return;
    delete state.tables[name];
    state.relationships = state.relationships.filter(rel => !String(rel.from).startsWith(name+'.') && !String(rel.to).startsWith(name+'.'));
    state.activeTable = Object.keys(state.tables)[0] || '';
    save();
    els.queryEditor.value = state.activeTable ? `SELECT * FROM ${state.activeTable};` : '';
    renderAll();
    if (state.activeTable) runQuery();
    else renderResult({columns:[],rows:[]});
  };

  const saveCurrentQuery = () => {
    const sql = els.queryEditor.value.trim();
    if (!sql) return toast('Nothing to save.');
    const existing = state.savedQueries.find(item => item.sql === sql);
    if (existing) return toast('That query is already saved.');
    const suggested = sql.match(/FROM\s+([A-Za-z_][\w]*)/i)?.[1] || 'query';
    const name = prompt('Name this query:', `${suggested} query`);
    if (!name) return;
    state.savedQueries.unshift({ id:`q-${Date.now()}`, name:name.slice(0,40), sql });
    state.savedQueries = state.savedQueries.slice(0,30);
    save(); renderSidebar(); toast('Query saved.');
  };

  const resultToCSV = result => {
    const escape = value => {
      const text = value == null ? '' : String(value);
      return /[",\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
    };
    return [result.columns.map(escape).join(','), ...result.rows.map(row => result.columns.map(col => escape(row[col])).join(','))].join('\n');
  };

  const download = (content, filename, type='text/plain') => {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url),500);
  };

  const exportJSON = () => download(JSON.stringify(state,null,2),'sql-lab-backup.json','application/json');

  const sqlLiteral = value => {
    if (value == null) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return `'${String(value).replaceAll("'","''")}'`;
  };

  const exportSQL = () => {
    const lines = ['-- SQL Lab export', '-- Generated locally in your browser', ''];
    for (const [name,table] of Object.entries(state.tables)) {
      const typeMap = {text:'TEXT',number:'DECIMAL(18,2)',boolean:'BOOLEAN',date:'DATE'};
      lines.push(`CREATE TABLE ${name} (`);
      lines.push(table.columns.map(col => `  ${col.name} ${typeMap[col.type] || 'TEXT'}`).join(',\n'));
      lines.push(');','');
      for (const row of table.rows) {
        const cols = table.columns.map(col => col.name);
        lines.push(`INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map(col => sqlLiteral(row[col])).join(', ')});`);
      }
      lines.push('');
    }
    download(lines.join('\n'),'sql-lab-export.sql','text/sql');
  };

  const parseCSVText = text => {
    const rows = [];
    let row=[], field='', quote=false;
    for (let i=0;i<text.length;i++) {
      const ch=text[i], next=text[i+1];
      if (quote) {
        if (ch === '"' && next === '"') { field+='"'; i++; }
        else if (ch === '"') quote=false;
        else field+=ch;
      } else if (ch === '"') quote=true;
      else if (ch === ',') { row.push(field); field=''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row=[]; field=''; }
      else if (ch !== '\r') field+=ch;
    }
    row.push(field);
    if (row.some(value => value !== '')) rows.push(row);
    return rows;
  };

  const importFile = async file => {
    if (!file) return;
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        state = normalizeState(parsed);
        save(); renderAll();
        els.queryEditor.value = `SELECT * FROM ${state.activeTable};`;
        runQuery();
        toast('SQL Lab backup imported.');
      } else {
        const rows = parseCSVText(text);
        if (rows.length < 2) throw new Error('CSV needs a header and at least one row.');
        const headers = rows[0].map((value,index) => {
          const clean = String(value).trim().replace(/[^A-Za-z0-9_]/g,'_') || `column_${index+1}`;
          return /^[A-Za-z_]/.test(clean) ? clean : `col_${clean}`;
        });
        let name = file.name.replace(/\.csv$/i,'').replace(/[^A-Za-z0-9_]/g,'_').slice(0,24) || 'imported_data';
        if (!/^[A-Za-z_]/.test(name)) name = 'imported_' + name;
        let suffix=2, base=name;
        while (state.tables[name]) name=`${base}_${suffix++}`;
        const dataRows = rows.slice(1).map(values => Object.fromEntries(headers.map((header,index) => [header, stripQuotes(values[index] ?? '')])));
        state.tables[name] = { columns:headers.map(header => ({name:header,type:'text'})), rows:dataRows };
        state.activeTable=name; save(); renderAll();
        els.queryEditor.value=`SELECT * FROM ${name};`; runQuery(); toast(`${name} imported.`);
      }
    } catch (error) { toast(error.message || 'Import failed.'); }
    finally { els.importFile.value=''; }
  };

  const examples = [
    ['Filter rows',"SELECT name, city, plan FROM customers WHERE plan = 'Pro' ORDER BY name ASC;"],
    ['Top orders','SELECT id, customer_id, total, status FROM orders ORDER BY total DESC LIMIT 5;'],
    ['Count by status','SELECT status, COUNT(*) AS orders FROM orders GROUP BY status ORDER BY orders DESC;'],
    ['Average order','SELECT AVG(total) AS average_order FROM orders;'],
    ['Customer orders',"SELECT orders.id, customers.name, orders.total, orders.status FROM orders INNER JOIN customers ON orders.customer_id = customers.id WHERE orders.status = 'Delivered' ORDER BY total DESC;"],
    ['Product sales','SELECT product_id, SUM(total) AS revenue FROM orders GROUP BY product_id ORDER BY revenue DESC;']
  ];

  const renderExamples = () => {
    els.exampleList.innerHTML = examples.map(([name,sql],index) => `
      <button type="button" class="example-button" data-example="${index}">
        <strong>${escapeHtml(name)}</strong><code>${escapeHtml(sql)}</code>
      </button>
    `).join('');
  };

  els.tableList.addEventListener('click', event => {
    const button = event.target.closest('[data-table]');
    if (button) chooseTable(button.dataset.table);
  });

  els.savedQueryList.addEventListener('click', event => {
    const button = event.target.closest('[data-saved-query]');
    const item = state.savedQueries.find(query => query.id === button?.dataset.savedQuery);
    if (item) { els.queryEditor.value=item.sql; runQuery(); }
  });

  els.queryHistoryList.addEventListener('click', event => {
    const button = event.target.closest('[data-history-query]');
    const item = state.history.find(query => query.id === button?.dataset.historyQuery);
    if (item) { els.queryEditor.value=item.sql; runQuery(); }
  });

  els.builderTable.addEventListener('change', () => {
    state.activeTable = els.builderTable.value;
    save(); renderAll();
  });

  $('run-query-button').addEventListener('click', runQuery);
  $('format-query-button').addEventListener('click', formatQuery);
  $('apply-builder-button').addEventListener('click', applyBuilder);
  $('new-table-button').addEventListener('click', () => els.tableDialog.showModal());
  $('create-table-button').addEventListener('click', createTable);
  $('add-row-button').addEventListener('click', openRowDialog);
  $('save-row-button').addEventListener('click', saveRow);
  $('delete-table-button').addEventListener('click', deleteActiveTable);
  $('save-current-query-button').addEventListener('click', saveCurrentQuery);
  $('clear-history-button').addEventListener('click', () => { state.history=[]; save(); renderSidebar(); });
  $('reset-samples-button').addEventListener('click', () => {
    if (!confirm('Reset SQL Lab to the original sample database?')) return;
    state=sampleState(); save(); els.queryEditor.value='SELECT * FROM customers;'; renderAll(); runQuery(); toast('Samples reset.');
  });
  $('copy-results-button').addEventListener('click', async () => {
    if (!lastResult.columns.length) return toast('Run a query first.');
    const csv=resultToCSV(lastResult);
    try { await navigator.clipboard.writeText(csv); toast('Results copied as CSV.'); }
    catch { download(csv,'query-results.csv','text/csv'); }
  });
  $('export-json-button').addEventListener('click', exportJSON);
  $('export-sql-button').addEventListener('click', exportSQL);
  $('import-button').addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', () => importFile(els.importFile.files?.[0]));
  $('examples-button').addEventListener('click', () => els.examplesDialog.showModal());
  $('tutorial-button').addEventListener('click', () => els.tutorialDialog.showModal());
  $('brand-button').addEventListener('click', () => { state.activeTable=Object.keys(state.tables)[0] || ''; save(); renderAll(); });

  els.exampleList.addEventListener('click', event => {
    const button=event.target.closest('[data-example]');
    if (!button) return;
    const item=examples[Number(button.dataset.example)];
    if (!item) return;
    els.queryEditor.value=item[1];
    els.examplesDialog.close();
    runQuery();
  });

  els.queryEditor.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      runQuery();
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const start=els.queryEditor.selectionStart, end=els.queryEditor.selectionEnd;
      els.queryEditor.setRangeText('  ',start,end,'end');
    }
  });

  renderExamples();
  renderAll();
  runQuery();
})();