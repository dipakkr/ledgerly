# ledgerly

A small UPI payments ledger: customers, merchants, payments, refunds and merchant settlement.

- `migrations/`: the schema, applied in order and recorded in `schema_migrations`
- `src/queries/`: every query the app runs
- `npm run reset`: rebuild the local "prod" database with realistic data
- `npm start`: the ledger UI

```bash
cp .env.example .env   # point DATABASE_URL at a Postgres 16 database
npm install
npm run reset
npm start              # http://localhost:8800
```
