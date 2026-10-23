# Wdrożenie Pixel Arena: Vercel + Render

Interfejs działa na Vercel, a backend gry musi działać jako stale uruchomiony
serwer Node.js. Backend utrzymuje pokoje w pamięci procesu, wysyła aktualizacje
przez Server-Sent Events i zapisuje pokoje na trwałym dysku. Sam hosting
statycznego frontendu na Vercel nie uruchamia tego serwera.

## 1. Utwórz backend na Render

1. Zaloguj się do Render i wybierz **New > Blueprint**.
2. Wybierz repozytorium `doubbtx/graziemia` i gałąź `main`.
3. Zatwierdź konfigurację z `render.yaml`. Tworzy ona usługę Node.js z
   trwałym dyskiem dla danych pokoi. Plan serwera i dysk są usługami płatnymi
   Render; sprawdź aktualną cenę przed zatwierdzeniem.
4. Poczekaj, aż wdrożenie zakończy się pomyślnie. W ustawieniach usługi skopiuj
   jej publiczny adres, np. `https://graziemia-api-doubbtx.onrender.com`.
5. Otwórz `<adres-backendu>/api/health`. Powinna pojawić się odpowiedź JSON
   podobna do `{"ok":true,"version":6}`. Jeśli nie, sprawdź logi wdrożenia
   Render. Nie ustawiaj ręcznie `PORT` ani `DATA_DIR`; Render i Blueprint
   zapewniają odpowiednie wartości.

## 2. Podłącz frontend na Vercel do backendu

1. W Vercel otwórz projekt `graziemia` i przejdź do **Settings > Environment
   Variables**.
2. Dodaj zmienną `VITE_API_BASE_URL` z publicznym adresem Render, bez końcowego
   ukośnika, np. `https://graziemia-api-doubbtx.onrender.com`.
3. Zaznacz środowisko **Production**. Dodaj ją także do **Preview**, jeśli
   chcesz testować wdrożenia podglądowe. Ich domeny nie są domyślnie
   dopuszczone przez CORS; dodaj dokładne domeny preview do `ALLOWED_ORIGINS`
   usługi Render, rozdzielając wiele adresów przecinkami.
4. Wybierz **Redeploy** dla produkcji (zmienna Vite jest wczytywana podczas
   budowania frontendu).
5. Wejdź na `https://graziemia.vercel.app/`, utwórz lobby i sprawdź, czy można
   skopiować zaproszenie oraz dołączyć z innej karty/przeglądarki.

Adres `VITE_API_BASE_URL` trafia do kodu przeglądarki, więc jest publiczny.
To adres API, nie sekret — nigdy nie umieszczaj tam tokena ani hasła.

## Dlaczego pojawiał się błąd o braku danych backendu?

Gdy zmienna API nie jest ustawiona, interfejs kieruje `/api/create` do
`graziemia.vercel.app`. Wdrożenie statycznego frontendu zwraca wtedy stronę
HTML zamiast JSON z backendu i aplikacja pokazuje „Adres nie zwrócił danych
backendu gry.” Po ustawieniu zmiennej i ponownym wdrożeniu frontendu żądania
oraz strumień wydarzeń trafiają do serwera Render.
