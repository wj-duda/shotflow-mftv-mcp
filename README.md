# ShotFlow universes for MCP

Publiczny eksport materiałów i danych uniwersów MF TV oraz MF Creators dla GitHub Pages i MCP.

Repozytorium zawiera wybrane opisy, indeksy i zoptymalizowane obrazy. Nie zawiera kodu aplikacji ShotFlow, filmów, sekretów ani plików roboczych.

## Budowanie katalogu

Eksporter domyślnie przetwarza tylko nowe lub zmienione obrazy. Istniejące, aktualne pliki wykorzystuje ponownie:

```bash
npm run build -- --world /sciezka/do/swiata --brand-assets /sciezka/do/assetow
```

Pełną przebudowę wszystkich obrazów uruchamia się wyłącznie jawnie:

```bash
npm run build -- --world /sciezka/do/swiata --brand-assets /sciezka/do/assetow --full-rebuild
```

Dotychczasowa flaga `--only-new` pozostaje obsługiwana dla zgodności, ale nie jest już potrzebna.
