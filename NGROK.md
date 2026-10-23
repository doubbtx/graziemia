# Arena online przez ngrok

## Jednorazowe przygotowanie
1. Zainstaluj Node.js co najmniej 22.12.
2. Zainstaluj ngrok Agent CLI według [oficjalnej instrukcji](https://ngrok.com/download). Polecenie `ngrok version` powinno działać w terminalu.
3. Zaloguj się do swojego konta ngrok. Skopiuj authtoken z [panelu konta](https://dashboard.ngrok.com/get-started/your-authtoken).
4. Na swoim komputerze wykonaj, zastępując TWOJ_TOKEN własnym tokenem:
```bash
ngrok config add-authtoken TWOJ_TOKEN
```
Nie wysyłaj tokenu na czat, nie wpisuj go do Reacta ani do repozytorium. ngrok zapisuje go we własnej konfiguracji. Paczka nie zawiera Twojego tokenu ani binarnego programu ngrok.

## Uruchomienie
Windows: dwuklik START-ONLINE.cmd.

Alternatywnie, w folderze gry:
```bash
node scripts/online.mjs
```
Można też użyć:
```bash
npm run online
```
Linux/macOS:
```bash
sh START-ONLINE.sh
```
Dołączony interfejs jest już zbudowany. Nie trzeba wykonywać npm install, aby uruchomić gotową grę.

Launcher sprawdza dostępność ngrok i wolny port, uruchamia backend, sprawdza jego stan, a następnie wykonuje `ngrok http 3001 --inspect=false` (lub używa portu PORT). Inspekcja żądań jest wyłączona, aby ograniczyć przechwytywanie tokenów sesji gry w lokalnym inspektorze. Nie oznacza to braku wszystkich logów u dostawcy usługi.

## Zapraszanie znajomych
1. Otwórz publiczny adres HTTPS pokazany w terminalu ngrok, nie lokalny adres komputera.
2. Jeśli ngrok wyświetli stronę ostrzegawczą, wybierz Visit / Visit Site. Na darmowym planie taka strona może wystąpić.
3. W grze pozostaw pole adresu backendu puste. Jeśli wcześniej zapisałeś tam inny adres, usuń go przed utworzeniem lobby.
4. Utwórz lobby, a następnie wybierz Kopiuj zaproszenie. Znajomi otwierają link i dołączają kodem.
5. Pozostaw komputer i terminal uruchomione. Ctrl+C zatrzymuje procesy uruchomione przez launcher.

Tunel prowadzi do całej aplikacji Node: interfejsu, API i strumieni stanu. Nie wystawiaj portu 4040 ani folderu projektu. Nie używaj opcji przepisywania Host; backend sprawdza pochodzenie żądań. W zwykłym wariancie interfejs i API korzystają z jednego adresu i nie trzeba ustawiać ALLOWED_ORIGINS.

## Opcje
- PORT: inny port backendu.
- NGROK_BIN: pełna ścieżka do ngrok, gdy nie ma go w PATH.
- NGROK_URL: opcjonalny adres HTTPS domeny dostępnej na Twoim koncie; przekazywany jako --url. Nie gwarantuje przydzielenia domeny ani jej dostępności w danym planie.

## Ograniczenia i bezpieczeństwo
Nie uruchomiono rzeczywistego publicznego tunelu w środowisku przygotowania paczki. Nie sprawdzono połączenia z Twoim kontem. Testy launchera wykorzystują atrapę programu ngrok i nie potwierdzają łączności z usługą.

Darmowy plan ngrok ma limity transferu i żądań. Gra wysyła aktualizacje stanu podczas pojedynku, więc obserwuj zużycie w panelu konta. Publiczny link nie jest hasłem dostępu. Udostępniaj go tylko znajomym. Gra nie przeszła audytu bezpieczeństwa.

Uruchamiaj na prywatnym komputerze i prywatnej sieci. Nie wystawiaj usług ani danych służbowych bez zgody administratora.

## Dokumentacja
- [CLI: uruchamianie HTTP, authtoken, inspect i url](https://ngrok.com/docs/gateway/agent/cli)
- [Authtoken agenta](https://ngrok.com/docs/gateway/agent/authtokens)
- [Darmowy plan i strona ostrzegawcza](https://ngrok.com/docs/pricing-limits/free-plan-limits)
