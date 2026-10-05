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

## Wspólne dane systemu MF TV / MF Creators

Zwykły build korzysta z ostatniego `site/system/snapshot.json`: nie uruchamia
Firebase, nie zmienia zawartości pliku ani `generatedAt`. Brak migawki przerywa
build **przed czyszczeniem** katalogów świata. `--full-rebuild` dotyczy obrazów,
nie odświeża danych. `site/system` jest wspólne dla obu światów i nie podlega
czyszczeniu per-world. Także przy niestandardowym `--output` dane pozostają w
głównym `site/system`; do publikacji potrzebne jest całe drzewo `site`.

Jawne odświeżenie podczas budowania (dodaj zwykłe argumenty świata/assetów):

```bash
npm run build -- --world /sciezka/do/swiata --brand-assets /sciezka/do/assetow --live-data --atv-root /home/ojciech/atv --project-id aitv-42f4b --account wojtek.duda@gmail.com
```

Sam eksport bez przebudowy obrazów:

```bash
npm run system-data -- --live-data --atv-root /home/ojciech/atv --project-id aitv-42f4b --account wojtek.duda@gmail.com
```

`npm run system-data` bez flagi wyłącznie sprawdza zachowaną migawkę. Eksport
wywołuje lokalny `panel/functions/scripts/export-mcp-system.mjs` z repo atv.
Wymaga istniejącej sesji wskazanego konta Firebase CLI. Przy HTTP 401 odśwież ją
komendą `npx firebase projects:list --account=wojtek.duda@gmail.com --json`
z `atv/panel/functions`, a następnie ponów eksport. Sekrety nie są publikowane.

Zakres: maks. 10 gotowych stron TOP1000, tagi, dwa parametry ekonomii, dwie
oferty sklepu, publiczne transmisje z poprzedniego i bieżącego tygodnia
kalendarzowego Europe/Warsaw według daty planowanej, ich ukończone odtworzenia.
Limity: 64 kandydatów na transmisje, 300 ukończeń na transmisję, 2000 łącznie,
84 żądania Firestore. Zapytania pobierają tylko wskazane pola. Przekroczenie
limitu przerywa eksport; nigdy nie publikuje nieoznaczonej częściowej listy.
TOP1000 jest celowo ograniczonym wycinkiem całego rankingu. Brak skanów kolekcji
utworów, kanałów, portfeli i historii głosów. Odczyty nie stanowią jednej
transakcyjnej migawki. Nie ma zapisów do Firebase ani nowego endpointu Firebase.

Dane przechodzą allowlistę pól i walidację; kompletny JSON zastępuje poprzedni
atomowym rename. Błąd pozostawia poprzedni plik. Oba procesy odświeżające należy
uruchamiać kolejno. Plik jest przygotowaniem do publikacji, nie samym deployem.

`site/system/guide.json` to wersjonowana, osobna dokumentacja podstawowych zasad
i adresów stron; `--live-data` jej nie nadpisuje. Nie jest pełną specyfikacją
wszystkich reguł. Narzędzia MCP `get_system_guide` i `get_last_data_snapshot` korzystają
z GitHub Pages i pięciominutowego cache, bez czytania Firestore podczas rozmowy.
Odpowiedzi danych są stronicowane (maks. 50 pozycji) i zawierają datę migawki.
Publikuj pliki systemu przed wdrożeniem nowych narzędzi MCP. Sama zmiana tego
repozytorium nie aktualizuje działających funkcji MCP.

Testy offline: `npm test`. Eksport danych jest niezależny od builda grafik.
