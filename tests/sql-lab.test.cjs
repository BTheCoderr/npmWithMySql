const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./harness.cjs');

test('SELECT filters and sorts sample data', () => {
  const h=createHarness();
  const result=h.api.executeSQL("SELECT name, city FROM customers WHERE plan = 'Pro' ORDER BY name ASC;");
  assert.deepEqual(Array.from(result.columns), ['name','city']);
  assert.deepEqual(result.rows.map(row => row.name), ['Ava Brooks','Lucas Kim','Maya Patel']);
});

test('aggregates and joins return expected results', () => {
  const h=createHarness();
  const grouped=h.api.executeSQL('SELECT status, COUNT(*) AS orders FROM orders GROUP BY status ORDER BY orders DESC;');
  assert.equal(grouped.rows[0].status,'Delivered');
  assert.equal(grouped.rows[0].orders,3);

  const joined=h.api.executeSQL("SELECT orders.id, customers.name, orders.total FROM orders INNER JOIN customers ON orders.customer_id = customers.id WHERE orders.status = 'Delivered' ORDER BY total DESC;");
  assert.equal(joined.rows.length,3);
  assert.equal(joined.rows[0].name,'Eli Walker');
  assert.equal(joined.rows[0].total,159);
});

test('INSERT, UPDATE, and DELETE mutate the local engine', () => {
  const h=createHarness();
  h.api.setSafeMutations(false);

  h.run("INSERT INTO products (id, name, category, price, stock) VALUES (106, 'Desk Lamp', 'Accessories', 45, 12);");
  let row=h.api.executeSQL('SELECT name, price, stock FROM products WHERE id = 106;').rows[0];
  assert.equal(row.name,'Desk Lamp');
  assert.equal(row.price,45);

  h.run('UPDATE products SET price = 55, stock = 9 WHERE id = 106;');
  row=h.api.executeSQL('SELECT name, price, stock FROM products WHERE id = 106;').rows[0];
  assert.equal(row.price,55);
  assert.equal(row.stock,9);

  h.run('DELETE FROM products WHERE id = 106;');
  assert.equal(h.api.executeSQL('SELECT * FROM products WHERE id = 106;').rows.length,0);
});

test('Safe Mode previews mutations and rollback restores persisted data', () => {
  const h=createHarness();
  assert.equal(h.api.getState().safeMutations,true);

  h.run("UPDATE orders SET status = 'Delivered' WHERE id = 9002;");
  assert.ok(h.api.getPendingTransaction());
  assert.equal(h.api.executeSQL('SELECT status FROM orders WHERE id = 9002;').rows[0].status,'Delivered');

  h.api.rollbackPendingTransaction();
  assert.equal(h.api.getPendingTransaction(),null);
  assert.equal(h.api.executeSQL('SELECT status FROM orders WHERE id = 9002;').rows[0].status,'Processing');
});

test('commit, undo, and redo restore mutation snapshots', () => {
  const h=createHarness();

  h.run("UPDATE orders SET status = 'Delivered' WHERE id = 9002;");
  h.api.commitPendingTransaction();
  assert.equal(h.api.getUndoCount(),1);
  assert.equal(h.api.executeSQL('SELECT status FROM orders WHERE id = 9002;').rows[0].status,'Delivered');

  h.api.undoMutation();
  assert.equal(h.api.executeSQL('SELECT status FROM orders WHERE id = 9002;').rows[0].status,'Processing');
  assert.equal(h.api.getRedoCount(),1);

  h.api.redoMutation();
  assert.equal(h.api.executeSQL('SELECT status FROM orders WHERE id = 9002;').rows[0].status,'Delivered');
});

test('query tabs persist SQL independently', () => {
  const h=createHarness();
  const first=h.api.getState().activeQueryTabId;
  h.api.setEditorSQL('SELECT name FROM customers;');
  h.api.createQueryTab();
  let state=h.api.getState();
  assert.equal(state.queryTabs.length,2);
  const second=state.activeQueryTabId;

  h.api.setEditorSQL('SELECT name FROM products;');
  h.api.switchQueryTab(first);
  state=h.api.getState();
  assert.equal(state.queryTabs.find(tab => tab.id===first).sql,'SELECT name FROM customers;');

  h.api.switchQueryTab(second);
  state=h.api.getState();
  assert.equal(state.queryTabs.find(tab => tab.id===second).sql,'SELECT name FROM products;');
});

test('challenge catalog remains complete', () => {
  const h=createHarness();
  assert.equal(h.api.getChallengeCount(),6);
});
