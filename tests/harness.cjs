const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createElement(id) {
  const listeners = new Map();
  const element = {
    id,
    value: id === 'query-editor' ? 'SELECT * FROM customers;' : '',
    textContent: '',
    innerHTML: '',
    className: '',
    dataset: {},
    files: [],
    hidden: false,
    disabled: false,
    open: false,
    selectionStart: 0,
    selectionEnd: 0,
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    addEventListener(type, handler) {
      const handlers = listeners.get(type) || [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    dispatch(type, event = {}) {
      for (const handler of listeners.get(type) || []) {
        handler({
          target: element,
          currentTarget: element,
          preventDefault() {},
          ...event
        });
      }
    },
    showModal() { element.open = true; },
    close() { element.open = false; },
    click() { element.dispatch('click'); },
    focus() {},
    scrollIntoView() {},
    querySelectorAll() { return []; },
    setRangeText(text, start, end) {
      element.value = element.value.slice(0, start) + text + element.value.slice(end);
    }
  };
  return element;
}

function createHarness() {
  const root = path.join(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
  const elements = new Map();

  const storage = {
    data: new Map(),
    getItem(key) { return this.data.get(key) || null; },
    setItem(key, value) { this.data.set(key, String(value)); }
  };

  const context = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    Map,
    Set,
    Uint8Array,
    Buffer,
    performance: { now: () => 0 },
    localStorage: storage,
    navigator: { clipboard: { writeText: async () => {} }, serviceWorker: null },
    location: { protocol: 'file:', hash: '', href: 'https://sql-lab.test/', pathname: '/', search: '' },
    history: { replaceState() {} },
    confirm: () => true,
    prompt: () => null,
    URL: { createObjectURL: () => '', revokeObjectURL() {} },
    Blob: function Blob() {},
    TextEncoder: class TextEncoder {
      encode(value) { return Uint8Array.from(Buffer.from(String(value), 'utf8')); }
    },
    TextDecoder: class TextDecoder {
      decode(value) { return Buffer.from(value).toString('utf8'); }
    },
    btoa(value) { return Buffer.from(value, 'binary').toString('base64'); },
    atob(value) { return Buffer.from(value, 'base64').toString('binary'); },
    __SQL_LAB_TEST__: true
  };

  context.document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement(id));
      return elements.get(id);
    },
    createElement() { return createElement('created'); }
  };
  context.window = { addEventListener() {} };
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'index.js' });

  return {
    api: context.SQLLabTest,
    elements,
    storage,
    run(sql) {
      context.SQLLabTest.setEditorSQL(sql);
      context.SQLLabTest.runQuery();
      return {
        state: context.SQLLabTest.getState(),
        summary: elements.get('result-summary')?.textContent,
        status: elements.get('result-status')?.textContent,
        visualizer: elements.get('visualizer-summary')?.textContent
      };
    }
  };
}

module.exports = { createHarness };
