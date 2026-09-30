# SQL Lab

<!-- repo-intro:start -->
**Project snapshot:** SQL Lab is a browser-based SQL learning IDE with a focused execution engine, safe mutation previews, persistent workspaces, query visualization, challenges, exports, offline support, and CI.

**What it demonstrates:** JavaScript · SQL parsing/execution · PWA · testing/CI · developer-tool UX.
<!-- repo-intro:end -->

![CI](https://github.com/BTheCoderr/npmWithMySql/actions/workflows/ci.yml/badge.svg)

**SQL Lab is a local-first SQL learning IDE that runs entirely in the browser.** It combines a custom SQL execution layer, safe mutation workflows, query visualization, guided practice, persistent workspaces, import/export tooling, offline support, and automated CI.

The project is designed to make SQL behavior visible instead of treating the database as a black box. Users can write queries, inspect the execution flow, experiment with data safely, and understand how tables relate without creating an account or provisioning a hosted database.

## Engineering highlights

| Area | Implementation |
| --- | --- |
| SQL engine | Browser-side parser/executor for a focused SQL subset |
| Query support | `SELECT`, `WHERE`, `ORDER BY`, `LIMIT`, `GROUP BY`, `COUNT`, `SUM`, `AVG`, simple `INNER JOIN` |
| Mutations | `INSERT`, `UPDATE`, and `DELETE` |
| Safety | Preview-first mutations with explicit Commit / Rollback |
| State history | Session-scoped Undo / Redo for committed mutations |
| Editor | Up to eight persistent query tabs |
| Learning UX | Visual query pipeline + six challenges across three unlockable tracks |
| Data tooling | CSV import, JSON workspace backup, SQL export, CSV result export, shareable workspace links |
| Persistence | Local storage, no account or backend required |
| Offline | Installable PWA with service-worker caching |
| Quality | Node test suite + GitHub Actions CI on pushes and pull requests |

## Product capabilities

- Browse and inspect sample or imported tables.
- Create tables and add, edit, or delete rows.
- Run read and mutation SQL against the local workspace.
- Preview `INSERT`, `UPDATE`, and `DELETE` before committing changes.
- Roll back pending mutations or undo/redo committed changes.
- Work across multiple persistent SQL editor tabs.
- Visualize how SQL Lab interprets each query step.
- Build queries with the visual query builder.
- Save queries and revisit execution history.
- Progress through Foundations, Aggregates, and Joins challenge tracks.
- Inspect schemas and defined relationships.
- Import CSV datasets.
- Export the complete workspace as JSON or SQL.
- Copy result sets as CSV.
- Share a self-contained workspace link when the dataset is small enough.
- Install the app and keep the application shell available offline.

## Supported SQL

```sql
SELECT ...
FROM ...
INNER JOIN ... ON ...
WHERE ...
GROUP BY ...
ORDER BY ...
LIMIT ...

INSERT INTO ... VALUES ...
UPDATE ... SET ... WHERE ...
DELETE FROM ... WHERE ...
```

Aggregates currently include `COUNT`, `SUM`, and `AVG`. SQL Lab intentionally implements a focused learning subset rather than attempting to replace a production database engine.

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
INNER JOIN customers
  ON orders.customer_id = customers.id
WHERE orders.status = 'Delivered'
ORDER BY total DESC;
```

```sql
UPDATE orders
SET status = 'Delivered'
WHERE id = 9002;
```

## Architecture

SQL Lab deliberately has no application server or hosted database. The SQL subset is parsed and executed against an in-memory workspace in the browser, while durable workspace state is written to local storage.

Mutation statements use a preview transaction by default. While a mutation is pending, the working state reflects the proposed change, but the persisted workspace continues to store the pre-mutation snapshot. **Commit** makes the new state durable; **Rollback** restores the previous snapshot.

Undo and redo snapshots are session-scoped to avoid repeatedly persisting large database copies. Query tabs, saved queries, challenge progress, and normal workspace data remain persistent.

## Testing and CI

The test suite loads the **real committed browser bundle** inside a lightweight DOM harness rather than maintaining a second SQL implementation just for tests.

Current coverage exercises:

- filtering and sorting
- aggregates and grouping
- joins
- `INSERT` / `UPDATE` / `DELETE`
- safe mutation rollback
- commit → undo → redo
- persistent query-tab behavior
- challenge-catalog integrity

Run the same checks used by CI:

```bash
npm run ci
```

GitHub Actions runs the syntax checks and Node test suite automatically on pushes and pull requests.

## Run locally

There is no build step.

```bash
npm start
```

You can also open `index.html` directly for basic local usage.

## Deployment

SQL Lab is a static application. `vercel.json` prepares the project for Vercel, while `netlify.toml` remains available for Netlify-compatible hosting.

## Project evolution

This repository began as an early Node/MySQL learning exercise. It has since been rebuilt into a standalone SQL learning IDE while preserving the original database-learning goal. The current implementation is intentionally focused on demonstrable engineering concerns: parsing, state modeling, safe mutations, persistence, offline behavior, testing, CI, and user-facing developer tooling.
