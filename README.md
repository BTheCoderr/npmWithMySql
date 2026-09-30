# SQL Lab

SQL Lab is the modern rebuild of the original `npmWithMySql` practice repo.

The first version was a tiny Node/Express experiment that connected to MySQL and inserted one hard-coded employee. The rebuilt version keeps the database-learning goal but turns it into a complete local-first SQL playground that runs entirely in the browser.

## What you can do

- Browse multiple sample tables
- Create your own tables and add rows
- Run SQL-style `SELECT` queries
- Filter with `WHERE`
- Sort with `ORDER BY`
- Limit results with `LIMIT`
- Use `COUNT`, `SUM`, and `AVG`
- Group results with `GROUP BY`
- Run simple `INNER JOIN` queries
- Build queries visually without typing SQL
- Save queries and revisit query history
- Inspect table schemas and relationships
- Import CSV data
- Export the full workspace as JSON
- Export the local database as SQL
- Copy result sets as CSV
- Reset to the built-in Customers / Products / Orders sample database
- Install the app and keep the shell available offline after the first visit

## Local-first storage

All workspace data is stored in the browser under:

```
sql-lab-v1
```

There is no account, hosted database, or backend requirement.

## Supported SQL subset

SQL Lab intentionally focuses on a beginner-friendly subset:

```sql
SELECT ...
FROM ...
INNER JOIN ... ON ...
WHERE ...
GROUP BY ...
ORDER BY ...
LIMIT ...
```

Aggregates currently include `COUNT`, `SUM`, and `AVG`.

This is a learning playground, not a full SQL database engine.

## Example queries

```sql
SELECT name, city, plan
FROM customers
WHERE plan = 'Pro'
ORDER BY name ASC;
```

```sql
SELECT status, COUNT(*) AS orders
FROM orders
GROUP BY status
ORDER BY orders DESC;
```

```sql
SELECT orders.id, customers.name, orders.total
FROM orders
INNER JOIN customers ON orders.customer_id = customers.id
WHERE orders.status = 'Delivered'
ORDER BY total DESC;
```

## Run locally

No build step is required. Open `index.html` directly, or use:

```bash
npm start
```

## Netlify

The project is a static site. `netlify.toml` publishes the repository root directly.

## Why this repo changed

The original project documented an early step in learning Node and MySQL. SQL Lab preserves that history while turning the same learning goal into something interactive, reusable, and portfolio-ready.
