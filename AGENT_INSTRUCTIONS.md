# Instruktioner för API på Vercel

Detta projekt (och liknande) deployas på **Vercel**, som hanterar routing annorlunda än Express. Följ dessa principer:

## 1. Routing via filstruktur
- Varje fil i `api/`-mappen motsvarar en endpoint.
  - `api/notes.js` → `/api/notes`
  - `api/notes/[id].js` → `/api/notes/:id`

## 2. Ansvar per fil
- `api/notes.js`: hantera `GET` (lista alla) och `POST` (skapa ny).
- `api/notes/[id].js`: hantera `GET`, `PATCH` och `DELETE` för en enskild rad.

## 3. Express används inte för CRUD
- Skriv inte routes i `app.js`.
- Använd istället filstrukturen som ovan. `app.js` kan finnas kvar om du har statisk frontend (t.ex. public/).

## 4. Databasanslutning
- Använd lazy-init för `pg.Pool` (initieras bara en gång).
- Skapa tabeller i en separat `ensure()`-funktion som körs vid första requesten.
- Använd en `initialized`-flagga för att undvika att skapa tabeller flera gånger.

## 5. Standard för svarskoder
- `200 OK`: lyckad GET/POST, returnera JSON.
- `204 No Content`: lyckad DELETE, ingen body.
- `400 Bad Request`: ogiltig indata.
- `404 Not Found`: resurs saknas.
- `405 Method Not Allowed`: metoden stöds inte i denna route.
- `500 Internal Server Error`: databasfel eller oväntat undantag.

## 6. Frontend-anrop
- Läs alla: `fetch('/api/notes')`
- Skapa ny: 
  ```js
  fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content })
  })
  ```
- Ta bort:
  ```js
  fetch(`/api/notes/${id}`, { method: 'DELETE' })
  ```

## 7. Felsökning
- Använd DevTools → Network:
  - Kontrollera **URL** och **Method**.
  - Om du får `404` direkt från Vercel är det nästan alltid fel filnamn eller fel mapp i `api/`.
