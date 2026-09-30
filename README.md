# ShotFlow universes for MCP

Publiczny eksport materiałów i danych uniwersów MF TV oraz MF Creators dla GitHub Pages i MCP.

Repozytorium zawiera wybrane opisy, indeksy i zoptymalizowane obrazy. Nie zawiera kodu aplikacji ShotFlow, filmów, sekretów ani plików roboczych.

## Budowanie katalogu

Świat jest wymagany przez `--world` albo zmienną `SHOTFLOW_WORLD`. Eksporter sam wybiera bezpieczny katalog wyjściowy: `aimftv` buduje do `site`, a pozostałe światy do `site/<universeId>`. Opcjonalne `--output` służy wyłącznie do świadomego nadpisania tego wyboru; eksport `mf-creators` bezpośrednio do głównego `site` jest blokowany, aby nie usunąć danych MF TV.

Eksporter domyślnie przetwarza tylko nowe lub zmienione obrazy. Istniejące, aktualne pliki wykorzystuje ponownie:

```bash
npm run build -- --world /sciezka/do/swiata --brand-assets /sciezka/do/assetow
```

MF Creators nie wymaga ręcznego wskazywania katalogu wyjściowego:

```bash
npm run build -- --world /sciezka/do/worlds/mf-creators
```

Pełną przebudowę wszystkich obrazów uruchamia się wyłącznie jawnie:

```bash
npm run build -- --world /sciezka/do/swiata --brand-assets /sciezka/do/assetow --full-rebuild
```

Dotychczasowa flaga `--only-new` pozostaje obsługiwana dla zgodności, ale nie jest już potrzebna.
