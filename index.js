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
    history: [],
    challengeIndex: 0,
    challengeProgress: []
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
      history:Array.isArray(raw.history) ? raw.history.filter(Boolean).slice(0,30) : [],
      challengeIndex:Number.isInteger(raw.challengeIndex) ? Math.max(0, Math.min(5, raw.challengeIndex)) : 0,
      challengeProgress:Array.isArray(raw.challengeProgress) ? [...new Set(raw.challengeProgress.filter(value => typeof value === 'string'))].slice(0,20) : []
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
  let editingRowIndex = null;
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
    examplesDialog:$('examples-dialog'), exampleList:$('example-list'), tutorialDialog:$('tutorial-dialog'), toast:$('toast'),
    challengeCard:$('challenge-card'), challengeProgress:$('challenge-progress'), challengeDifficulty:$('challenge-difficulty'),
    challengeNumber:$('challenge-number'), challengeTitle:$('challenge-title'), challengeDescription:$('challenge-description'),
    challengeHint:$('challenge-hint'), challengeStatus:$('challenge-status')
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
    if (/\s+OR\s+/i.test(clause)) throw new Error('OR conditions are not supported yet. Use AND or split this into separate practice queries.');
    const conditions = clause.split(/\s+AND\s+/i).map(text => text.trim()).filter(Boolean);
    return rows.filter(row => conditions.every(condition => {
      const match = condition.match(/^([A-Za-z_][\w.]*?)\s*(LIKE|>=|<=|!=|=|>|<)\s*(.+)$/i);
      if (!match) throw new Error(`Unsupported WHERE condition: ${condition}`);
      return compare(fieldValue(row, match[1]), match[2], stripQuotes(match[3]));
    }));
  };

  const qualifyRows = (tableName, rows) => rows.map((row, index) => {
    const record = { ...row };
    Object.defineProperty(record, '__sourceIndex', { value:index, enumerable:false });
    for (const [key,value] of Object.entries(row)) record[tableName + '.' + key] = value;
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
      return rows.map(row => {
        const output = Object.fromEntries(Object.entries(row).filter(([key]) => !key.includes('.')));
        Object.defineProperty(output, '__sourceIndex', { value:row.__sourceIndex, enumerable:false });
        return output;
      });
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
        Object.defineProperty(output, '__sourceIndex', { value:row.__sourceIndex, enumerable:false });
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

    const hasAggregate = expressions.map(expressionMeta).some(meta => meta.aggregate);
    return {
      rows:projected,
      columns:projected.length ? Object.keys(projected[0]) : expressions.map(expression => expressionMeta(expression).alias || expressionMeta(expression).raw.split('.').pop()),
      editable:!joinMatch && !groupMatch && !hasAggregate,
      sourceTable:baseTable
    };
  };

  const renderResult = (result, durationMs=0) => {
    lastResult = result;
    els.resultSummary.textContent = result.rows.length + ' row' + (result.rows.length === 1 ? '' : 's');
    els.resultStatus.textContent = 'Query completed in ' + durationMs + ' ms · ' + result.columns.length + ' column' + (result.columns.length === 1 ? '' : 's') + (result.editable ? ' · rows editable' : '');
    els.resultStatus.className = 'result-status success';

    if (!result.columns.length) {
      els.resultsTable.innerHTML = '';
      return;
    }

    const actionHead = result.editable ? '<th>Actions</th>' : '';
    const body = result.rows.map(row => {
      const cells = result.columns.map(col => {
        const value = row[col];
        return '<td class="' + (value == null ? 'null' : '') + '">' + (value == null ? 'NULL' : escapeHtml(value)) + '</td>';
      }).join('');
      const index = row.__sourceIndex;
      const actions = result.editable && Number.isInteger(index)
        ? '<td class="row-actions"><button type="button" data-edit-row="' + index + '">Edit</button><button type="button" class="danger-row" data-delete-row="' + index + '">Delete</button></td>'
        : '';
      return '<tr>' + cells + actions + '</tr>';
    }).join('');

    els.resultsTable.innerHTML =
      '<thead><tr>' + result.columns.map(col => '<th>' + escapeHtml(col) + '</th>').join('') + actionHead + '</tr></thead>' +
      '<tbody>' + body + '</tbody>';
  };

  const friendlyQueryError = (error, sql) => {
    const message = String(error?.message || 'Unable to run query.');
    if (/does not exist/i.test(message)) return message + ' Check the Tables list on the left for the exact table name.';
    if (/Unsupported WHERE/i.test(message)) return message + ' Try a simple condition like WHERE status = \'Delivered\'.';
    if (/OR conditions/i.test(message)) return message;
    if (!/\bFROM\b/i.test(sql) && /^\s*SELECT\b/i.test(sql)) return 'SQL Lab tip: SELECT queries need a FROM clause, for example SELECT * FROM customers;';
    if (!/^\s*SELECT\b/i.test(sql)) return 'SQL Lab currently focuses on SELECT practice. Start with SELECT, then use FROM, WHERE, GROUP BY, ORDER BY, or LIMIT.';
    return message + ' Open Examples if you want a working query to compare against.';
  };

  const challenges = [
    {
      id:'pro-customers', difficulty:'Beginner', title:'Filter the Pro customers',
      description:'Return name, city, and plan for only Pro customers, sorted by name A–Z.',
      hint:"Use WHERE plan = 'Pro' and ORDER BY name ASC.",
      starter:'SELECT name, city, plan FROM customers;',
      answer:"SELECT name, city, plan FROM customers WHERE plan = 'Pro' ORDER BY name ASC;"
    },
    {
      id:'top-products', difficulty:'Beginner', title:'Find the three most expensive products',
      description:'Return name and price for the top 3 products from highest price to lowest.',
      hint:'Sort price DESC, then LIMIT the result to 3 rows.',
      starter:'SELECT name, price FROM products;',
      answer:'SELECT name, price FROM products ORDER BY price DESC LIMIT 3;'
    },
    {
      id:'orders-by-status', difficulty:'Intermediate', title:'Count orders by status',
      description:'Return each order status and the number of orders in that status.',
      hint:'Use COUNT(*) with GROUP BY status.',
      starter:'SELECT status FROM orders;',
      answer:'SELECT status, COUNT(*) AS orders FROM orders GROUP BY status ORDER BY orders DESC;'
    },
    {
      id:'average-order', difficulty:'Intermediate', title:'Calculate the average order value',
      description:'Return one column named average_order containing the average of order totals.',
      hint:'AVG(total) does the calculation. Add AS average_order for the column name.',
      starter:'SELECT total FROM orders;',
      answer:'SELECT AVG(total) AS average_order FROM orders;'
    },
    {
      id:'delivered-customers', difficulty:'Advanced', title:'Join delivered orders to customers',
      description:'Return order id, customer name, and total for delivered orders, highest total first.',
      hint:"Join orders.customer_id to customers.id, then filter status = 'Delivered'.",
      starter:'SELECT orders.id, customers.name, orders.total FROM orders INNER JOIN customers ON orders.customer_id = customers.id;',
      answer:"SELECT orders.id, customers.name, orders.total FROM orders INNER JOIN customers ON orders.customer_id = customers.id WHERE orders.status = 'Delivered' ORDER BY total DESC;"
    },
    {
      id:'revenue-by-product', difficulty:'Advanced', title:'Group revenue by product',
      description:'Return product_id and total revenue for each product, highest revenue first.',
      hint:'SUM(total) with GROUP BY product_id will produce one row per product.',
      starter:'SELECT product_id, total FROM orders;',
      answer:'SELECT product_id, SUM(total) AS revenue FROM orders GROUP BY product_id ORDER BY revenue DESC;'
    }
  ];

  const comparableResult = result => JSON.stringify({
    columns:result.columns,
    rows:result.rows.map(row => result.columns.map(col => {
      const value=row[col];
      return typeof value === 'number' ? Number(value.toFixed(8)) : value;
    }))
  });

  const renderChallenge = () => {
    const challenge=challenges[state.challengeIndex] || challenges[0];
    const complete=state.challengeProgress.includes(challenge.id);
    els.challengeProgress.textContent=state.challengeProgress.length + ' / ' + challenges.length + ' completed';
    els.challengeDifficulty.textContent=challenge.difficulty;
    els.challengeNumber.textContent='Challenge ' + (state.challengeIndex + 1) + ' of ' + challenges.length;
    els.challengeTitle.textContent=challenge.title;
    els.challengeDescription.textContent=challenge.description;
    els.challengeHint.textContent=challenge.hint;
    els.challengeHint.hidden=true;
    els.challengeStatus.textContent=complete
      ? 'Completed ✓ You can rerun it or move to the next challenge.'
      : 'Run your query and SQL Lab will check the result automatically.';
    els.challengeStatus.className='challenge-status' + (complete ? ' passed' : '');
  };

  const evaluateChallenge = result => {
    const challenge=challenges[state.challengeIndex] || challenges[0];
    let expected;
    try { expected=executeSelect(challenge.answer); } catch { return; }
    if (comparableResult(result) === comparableResult(expected)) {
      if (!state.challengeProgress.includes(challenge.id)) state.challengeProgress.push(challenge.id);
      save();
      renderChallenge();
      els.challengeStatus.textContent='Passed ✓ That result is correct.';
      els.challengeStatus.className='challenge-status passed';
      toast('Challenge passed!');
    } else {
      els.challengeStatus.textContent='Not quite yet — your query ran, but the result does not match the challenge target.';
      els.challengeStatus.className='challenge-status active';
    }
  };

  const loadChallenge = () => {
    const challenge=challenges[state.challengeIndex] || challenges[0];
    els.queryEditor.value=challenge.starter;
    els.challengeHint.hidden=true;
    els.queryEditor.focus();
    els.challengeStatus.textContent='Challenge loaded. Edit the starter query, then Run query.';
    els.challengeStatus.className='challenge-status active';
  };

  const moveChallenge = delta => {
    state.challengeIndex=(state.challengeIndex + delta + challenges.length) % challenges.length;
    save();
    renderChallenge();
  };

  const runQuery = () => {
    const sql = els.queryEditor.value.trim();
    if (!sql) return toast('Write a query first.');
    const start = performance.now();
    try {
      const result = executeSelect(sql);
      const duration = Math.max(0, Math.round(performance.now()-start));
      renderResult(result, duration);
      evaluateChallenge(result);
      state.history = [{ id:`h-${Date.now()}`, sql, count:result.rows.length, at:Date.now() }, ...state.history.filter(item => item.sql !== sql)].slice(0,30);
      save();
      renderSidebar();
    } catch (error) {
      els.resultSummary.textContent = 'Query error';
      els.resultStatus.textContent = friendlyQueryError(error, sql);
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

  const openRowDialog = (rowIndex=null) => {
    const table = state.tables[state.activeTable];
    if (!table) return toast('Choose a table first.');
    editingRowIndex=Number.isInteger(rowIndex) ? rowIndex : null;
    const current=editingRowIndex == null ? null : table.rows[editingRowIndex];
    if (editingRowIndex != null && !current) return toast('That row no longer exists.');
    els.rowDialogTitle.textContent = (editingRowIndex == null ? 'Add row to ' : 'Edit row in ') + state.activeTable;
    els.rowFields.innerHTML = table.columns.map(col => {
      const value=current?.[col.name];
      if (col.type === 'boolean') {
        return '<label><span>' + escapeHtml(col.name) + ' · boolean</span><select data-row-field="' + escapeHtml(col.name) + '" data-type="boolean"><option value="">NULL</option><option value="true">true</option><option value="false">false</option></select></label>';
      }
      const type=col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text';
      const step=col.type === 'number' ? ' step="any"' : '';
      return '<label><span>' + escapeHtml(col.name) + ' · ' + escapeHtml(col.type) + '</span><input data-row-field="' + escapeHtml(col.name) + '" data-type="' + escapeHtml(col.type) + '" type="' + type + '"' + step + ' value="' + escapeHtml(value ?? '') + '"></label>';
    }).join('');
    if (current) {
      els.rowFields.querySelectorAll('[data-row-field]').forEach(input => {
        const value=current[input.dataset.rowField];
        input.value=value == null ? '' : String(value);
      });
    }
    $('save-row-button').textContent=editingRowIndex == null ? 'Add row' : 'Save changes';
    els.rowDialog.showModal();
  };

  const saveRow = () => {
    const table = state.tables[state.activeTable];
    if (!table) return;
    const row = {};
    els.rowFields.querySelectorAll('[data-row-field]').forEach(input => {
      row[input.dataset.rowField] = coerceByType(input.value, input.dataset.type);
    });
    if (editingRowIndex == null) table.rows.push(row);
    else if (table.rows[editingRowIndex]) table.rows[editingRowIndex]=row;
    const edited=editingRowIndex != null;
    editingRowIndex=null;
    save();
    els.rowDialog.close();
    renderAll();
    runQuery();
    toast(edited ? 'Row updated.' : 'Row added.');
  };

  const deleteRow = rowIndex => {
    const table=state.tables[state.activeTable];
    if (!table || !table.rows[rowIndex]) return toast('That row no longer exists.');
    if (!confirm('Delete this row from ' + state.activeTable + '?')) return;
    table.rows.splice(rowIndex,1);
    save();
    renderAll();
    runQuery();
    toast('Row deleted.');
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

  const encodeWorkspace = value => {
    const bytes=new TextEncoder().encode(JSON.stringify(value));
    let binary='';
    for (let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(binary).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  };

  const decodeWorkspace = value => {
    let base=value.replaceAll('-','+').replaceAll('_','/');
    while (base.length % 4) base+='=';
    const binary=atob(base);
    const bytes=Uint8Array.from(binary, char => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  };

  const shareWorkspace = async () => {
    const payload={...state, history:[]};
    const encoded=encodeWorkspace(payload);
    const base=location.href.split('#')[0];
    const url=base + '#workspace=' + encoded;
    if (url.length > 12000) {
      exportJSON();
      return toast('Workspace is too large for a share link, so a JSON backup was downloaded instead.');
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('Share link copied.');
    } catch {
      prompt('Copy this SQL Lab workspace link:', url);
    }
  };

  const importSharedWorkspace = () => {
    const raw=location.hash.startsWith('#workspace=') ? location.hash.slice(11) : '';
    if (!raw) return false;
    try {
      state=normalizeState(decodeWorkspace(raw));
      save();
      if (history.replaceState) history.replaceState(null,'',location.pathname + location.search);
      toast('Shared workspace loaded.');
      return true;
    } catch {
      toast('That workspace link could not be loaded.');
      return false;
    }
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
  $('add-row-button').addEventListener('click', () => openRowDialog());
  $('save-row-button').addEventListener('click', saveRow);
  els.resultsTable.addEventListener('click', event => {
    const edit=event.target.closest('[data-edit-row]');
    if (edit) return openRowDialog(Number(edit.dataset.editRow));
    const remove=event.target.closest('[data-delete-row]');
    if (remove) deleteRow(Number(remove.dataset.deleteRow));
  });
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
  $('challenge-button').addEventListener('click', () => els.challengeCard.scrollIntoView({behavior:'smooth',block:'center'}));
  $('share-workspace-button').addEventListener('click', shareWorkspace);
  $('load-challenge-button').addEventListener('click', loadChallenge);
  $('previous-challenge-button').addEventListener('click', () => moveChallenge(-1));
  $('next-challenge-button').addEventListener('click', () => moveChallenge(1));
  $('hint-button').addEventListener('click', () => { els.challengeHint.hidden=!els.challengeHint.hidden; });
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

  importSharedWorkspace();
  renderExamples();
  renderAll();
  renderChallenge();
  runQuery();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();