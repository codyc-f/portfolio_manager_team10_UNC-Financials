# UNC Financials Frontend

Responsive React + TypeScript holdings workspace connected to the Flask and
MySQL backend.

## Run locally

Start Docker Compose from the repository root first. Then:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Architecture

- `src/api.ts` owns HTTP requests and converts backend `snake_case` responses
  into frontend `camelCase` types.
- `src/App.tsx` owns portfolio selection, loading states, forms, filters, and
  refreshes after mutations.
- `vite.config.ts` proxies relative `/api` requests to
  `http://127.0.0.1:5001`, so local browser requests do not require CORS.
- MySQL is the source of truth. The application no longer stores holdings in
  `localStorage`.

## CRUD lifecycle

For example, editing a holding follows this path:

1. The table opens the holding form with the selected row.
2. React converts the form into the backend payload and sends
   `PUT /api/holdings/<id>`.
3. Flask validates every field and updates MySQL with a parameterized query.
4. React reloads `GET /api/holdings?portfolio_id=<id>`.
5. The table renders the values returned by the database.

Forms remain open when validation or network requests fail, and repeated
submissions are disabled until the current request completes.
