# Bullshit Bingo Monday

**Maximale Synergie. Minimale Substanz.**

Das Live-Quiz für alle, die schon mal einen Quick Win in einen dreistündigen Workshop verwandelt haben. Was heißt die Floskel aus dem Meeting eigentlich? Vier Antworten stehen zur Wahl. Wer am Ende vorne liegt, wird zum **Daily Sprint Master** gekürt.

[Quiz öffnen](https://bingo.schuelting-develop.de)

## So läuft ein Quiz ab

1. Die Spielleitung erstellt eine Runde am PC. Sie stellt 5, 10 oder 15 Fragen, die Antwortzeit und die Pause zwischen den Fragen ein. Zur Wahl stehen Floskeln, Bedeutungen oder beide Fragerichtungen im Wechsel nach Zufall.
2. Die Mitspielenden scannen den QR-Code oder geben auf der Startseite den fünfstelligen Spielcode ein. Auf der Beitrittsseite geben sie ihren Namen ein. Die Spielleitung öffnet bei Bedarf die Beamer-Ansicht mit Frage, Countdown und Live-Ranking.
3. Sobald die erste Frage gestartet ist, läuft die Runde automatisch. Wenn alle geantwortet haben oder die Antwortzeit abläuft, erscheint die Lösung. Nach der eingestellten Pause startet die nächste Frage.
4. Nach der letzten Auflösung sehen Mitspielende, Spielleitung und Beamer die Siegerehrung. Bei Gleichstand teilen sich die Erstplatzierten den Titel. Die Spielleitung moderiert die Runde ohne eigenen Platz im Ranking.

Der Browser merkt sich den Zugang zur Runde. Nach dem Neuladen kannst du im selben Browser weiterspielen oder die Spielleitung wieder öffnen.

## Punkte und Gesamtwertung

| Antwort | Rundenpunkte |
| --- | ---: |
| Richtig | 100 bis 500, abhängig von der verbleibenden Antwortzeit |
| Falsch | −100 und ein Spruch aus der Chefetage |
| Keine Antwort | 0 |

Die Rangliste einer Runde zeigt die erspielten Rundenpunkte. Bei gleicher Punktzahl entscheidet die Anzahl richtiger Antworten. Für die Gesamtwertung werden die Rundenpunkte durch die Fragenzahl geteilt und mit zwei multipliziert. Damit liegt das Maximum bei **1.000 Wertungspunkten pro Runde**, unabhängig von der Länge. Die Startseite zeigt den Durchschnitt aus abgeschlossenen Runden, in denen der Spieler mindestens einmal geantwortet hat. Die Zuordnung über mehrere Runden läuft über den Browser.

## Floskeln ergänzen

Die mitgelieferte Liste steht in [begriffe.md](begriffe.md). Über **Neue Floskel hinzufügen** auf der Startseite kannst du den gemeinsamen Fragenpool um eine Floskel und ihre Bedeutung ergänzen. Die neuen Begriffe werden dauerhaft gespeichert.

Der Hintergrund zeigt zwei beispielhafte Unterlagen aus dem Lenkungskreis. Der Projektplan reicht bis 2042, und die Druckerpatronen-Strategie hat einen eigenen Kalendereintrag.

## Docker-Betrieb

Voraussetzung sind Docker und Docker Compose. Im Repository ausführen:

```bash
docker compose up -d --build --wait
curl -fsS http://127.0.0.1:18092/health
```

Die Anwendung bindet am Host an `127.0.0.1:18092`. Auf dem Produktionsserver leitet Caddy HTTPS und WebSockets für `bingo.schuelting-develop.de` an diesen Port weiter. Der QR-Code verwendet diese öffentliche Adresse.

FastAPI und Uvicorn bedienen die Weboberfläche und die Spielverbindungen. Uvicorn läuft mit einem Worker, damit die Live-Updates alle WebSocket-Verbindungen erreichen. SQLite speichert Runden, Ergebnisse und ergänzte Floskeln im Docker-Volume `game-data`. Das Volume bleibt beim Neubau des Containers erhalten.
