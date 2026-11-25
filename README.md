# 🎯 Bullshit Bingo

Ein webbasiertes **Buzzword-/Bullshit-Bingo für Meetings, Workshops und Präsentationen**.

Fällt ein typisches Management-Buzzword wie **„Quick Win“**, **„Deep Dive“**, **„Alignment“** oder **„Synergien heben“**, markieren die Spieler den entsprechenden Begriff auf ihrem Bingo-Feld.

Das Spiel läuft zentral auf einem Server und kann von beliebig vielen Spielern gleichzeitig über den Browser gespielt werden.

---

## 🎮 Spielprinzip

1. Ein Spieler erstellt eine neue **Bingo-Runde**.
2. Das System erzeugt einen eindeutigen **Game-Code**.
3. Andere Spieler öffnen die Website auf Smartphone, Tablet oder PC.
4. Sie geben den Game-Code und einen Spielernamen ein.
5. Jeder Spieler erhält automatisch ein **zufällig generiertes Bingo-Feld**.
6. Wird während des Meetings ein Buzzword genannt, klickt der Spieler den Begriff an.
7. Der Server aktualisiert sofort den **Live-Score aller Spieler**.
8. Erreicht ein Spieler eine vollständige Reihe, Spalte oder Diagonale, erhält er ein **BINGO**.

---

# 🏆 Live-Score

Während des Spiels wird eine Live-Rangliste angezeigt.

Beispiel:

| Platz | Spieler | Treffer | Bingos |
|---:|---|---:|---:|
| 🥇 1 | Carlo | 14 | 2 |
| 🥈 2 | Stefan | 12 | 1 |
| 🥉 3 | Jannes | 9 | 1 |
| 4 | Michael | 7 | 0 |

Die Rangliste wird **in Echtzeit** aktualisiert, ohne dass die Seite neu geladen werden muss.

Zusätzlich soll sichtbar sein:

- Anzahl markierter Begriffe
- Anzahl erreichter Bingos
- aktueller Platz
- Spieleranzahl
- Spielstatus
- führender Spieler

---

# 🎲 Bingo-Feld

Standardmäßig bekommt jeder Spieler ein:

**5 × 5 Bingo-Feld**

mit **25 zufällig ausgewählten Begriffen**.

Beispiel:

| | | | | |
|---|---|---|---|---|
| Quick Win | Alignment | KPI | Roadmap | Deep Dive |
| Stakeholder | Vision | MVP | Workshop | Scope |
| Buy-in | Sprint | Synergien heben | Governance | Benchmark |
| Transformation | Daily | Ownership | Use Case | Dashboard |
| SteerCo | Mission | Rollout | Pain Point | Commitment |

Jeder Spieler bekommt eine andere zufällige Kombination.

---

# ✅ Bingo-Regeln

Ein **Bingo** entsteht bei fünf markierten Feldern:

- horizontal
- vertikal
- diagonal

Optional sollen später weitere Spielmodi möglich sein:

- 1 Reihe
- 2 Reihen
- komplettes Feld
- X-Bingo
- Four Corners
- Blackout

---

# 👥 Multiplayer

Das Spiel soll vollständig multiplayerfähig sein.

Es gibt grundsätzlich keine feste Begrenzung der Spielerzahl.

Beispiel:

    Meeting
       │
       ├── Spieler 1
       ├── Spieler 2
       ├── Spieler 3
       ├── Spieler 4
       ├── ...
       └── Spieler n

Alle Spieler befinden sich in derselben **Game-Session**.

---

# 🔗 Spiel beitreten

Eine Runde kann über einen Game-Code betreten werden.

Beispiel:

    Game-Code: QWV42

Optional kann zusätzlich ein QR-Code angezeigt werden.

Spieler scannen den QR-Code und landen direkt im Spiel.

Beispiel:

    https://server/bingo/QWV42

Danach muss nur noch ein Spielername eingegeben werden.

---

# 👑 Host-Modus

Der Ersteller einer Runde ist der **Host**.

Der Host kann:

- Spiel starten
- Spiel pausieren
- Spiel zurücksetzen
- neue Runde starten
- Spielerübersicht sehen
- Teilnehmer entfernen
- Bingo-Feld-Größe festlegen
- Spielmodus auswählen
- Begriffe auswählen
- Live-Rangliste anzeigen

---

# 📺 Präsentationsmodus

Zusätzlich sollte es eine Ansicht geben, die auf einem Meeting-Bildschirm oder Beamer geöffnet werden kann.

Sie zeigt beispielsweise:

## Bullshit Bingo – Live

**18 Spieler online**

🥇 Carlo – 14 Treffer  
🥈 Stefan – 12 Treffer  
🥉 Jannes – 9 Treffer  

**🔥 Aktuell führt Carlo**

Dadurch kann das Spiel parallel zum Meeting auf einem Bildschirm verfolgt werden.

---

# 🧠 Buzzword-Datenbank

Die Begriffe werden zentral gespeichert.

Jeder Eintrag besteht mindestens aus:

| Feld | Beschreibung |
|---|---|
| `id` | eindeutige ID |
| `term` | Buzzword |
| `translation` | Was es eigentlich heißt |
| `active` | Begriff verwenden ja/nein |

Beispiel:

| Begriff | Was es eigentlich heißt |
|---|---|
| Jour fixe | Regelmäßiges Meeting |
| OKR-Set | Ziele + messbare Ergebnisse |
| North Star | Übergeordnetes Ziel |
| VUCA | Die Welt ist unberechenbar und kompliziert |
| Stakeholder | Leute, die irgendwie betroffen sind |
| Alignment | Alle sollen dasselbe verstanden haben |
| Buy-in | Zustimmung bekommen |
| Ownership | Einer muss sich verantwortlich fühlen |
| Empowerment | Gebt den Leuten die nötigen Rechte |
| Workshop | Meeting mit Whiteboard |
| Ideation | Brainstorming mit Berater-Vokabular |
| Challenge | Problem, das man nicht Problem nennen möchte |
| Quick Win | Einfach umsetzbare Verbesserung |
| Low-hanging Fruit | Noch einfacherer Quick Win |
| Dashboard | Hübsche Anzeige der Kennzahlen |
| Follow-up | Wir reden später nochmal darüber |
| Hybrid-agil | Wir planen doch ziemlich viel vorher |
| MVP | Erstmal eine einfache funktionierende Version |
| Business Case | Lohnt sich das überhaupt? |
| Digital Transformation | Große Veränderung, aber mit Software |
| Culture Change | Jetzt sollen sogar alle anders denken |
| Strategic Initiative | Projekt, das wichtig klingen soll |
| Holistisch | Alles irgendwie berücksichtigen |
| Synergien heben | Dinge zusammenbringen, damit es hoffentlich besser wird |
| Strategic Alignment | Passt es wirklich wirklich zur Strategie? |
| Paradigmenwechsel | Etwas ändert sich sehr stark |

Die vollständige Begriffsliste kann später in einer JSON-Datei oder Datenbank gepflegt werden.

---

# 💡 Begriffserklärung

Ein Spieler kann einen Begriff anklicken bzw. länger gedrückt halten und bekommt zusätzlich die Übersetzung angezeigt.

Beispiel:

**Synergien heben**

> Dinge zusammenbringen, damit es hoffentlich besser wird.

Dadurch ist das Spiel gleichzeitig ein kleines Management-Buzzword-Lexikon.

---

# 🏗 Technisches Konzept

Die Anwendung soll als zentrale Webanwendung betrieben werden.

Empfohlene Architektur:

    Browser
       │
       │ HTTPS
       ▼
    Webserver
       │
       ├── Spiellogik
       ├── Game Sessions
       ├── Spieler
       ├── Bingo-Felder
       └── Score Engine
       │
       ▼
    Datenbank

Für die Live-Kommunikation zwischen Spielern und Server sollten **WebSockets** eingesetzt werden.

Damit können Änderungen sofort an alle Teilnehmer übertragen werden.

---

# 🛠 Vorgesehener Technologie-Stack

Eine mögliche einfache Umsetzung:

**Backend**

- Python
- FastAPI
- WebSockets

**Frontend**

- HTML
- CSS
- JavaScript

**Datenbank**

Für kleine Installationen:

- SQLite

Für einen dauerhaft gehosteten Multiplayer-Server:

- PostgreSQL

---

# 🔄 Echtzeit-Kommunikation

Der Server verwaltet den aktuellen Zustand jeder Runde.

Beispiel:

    Spieler klickt "Quick Win"
              │
              ▼
          WebSocket
              │
              ▼
           Server
              │
        Score berechnen
              │
              ▼
       alle Spieler informieren
              │
              ▼
       Live-Rangliste aktualisieren

Dadurch sehen alle Teilnehmer Veränderungen praktisch sofort.

---

# 🗄 Datenmodell

## Games

    id
    game_code
    created_at
    status
    host_token

## Players

    id
    game_id
    name
    score
    bingo_count

## Buzzwords

    id
    term
    translation
    active

## PlayerCards

    id
    player_id
    buzzword_id
    position
    marked

---

# 🔐 Host-Berechtigung

Der Game-Code alleine darf keine Host-Rechte vergeben.

Beim Erstellen einer Runde erhält der Host zusätzlich einen zufälligen **Host-Token**.

Damit können administrative Aktionen geschützt werden.

---

# 🔌 Verbindungsabbrüche

Ein Spieler sollte nach einem Reload oder kurzen WLAN-Abbruch wieder in seine bestehende Runde zurückkehren können.

Dafür wird lokal eine zufällige Player-ID gespeichert.

Nach der Wiederverbindung lädt der Server:

- Bingo-Feld
- markierte Begriffe
- Treffer
- Bingos
- aktuellen Spielstand

wieder.

---

# 📱 Responsive Design

Die Oberfläche soll insbesondere für Smartphones optimiert werden.

Unterstützt werden sollen:

- Smartphone
- Tablet
- Notebook
- Desktop
- Beamer / Meetingraum-Display

Das Bingo-Feld muss sich automatisch an die Bildschirmgröße anpassen.

---

# 🚀 Deployment

Die Anwendung soll vollständig serverfähig aufgebaut werden.

Mögliche Container-Struktur:

    Docker
    │
    ├── Bullshit-Bingo App
    │      ├── FastAPI
    │      ├── Frontend
    │      └── WebSocket Server
    │
    └── PostgreSQL

Dadurch kann das Spiel beispielsweise auf einem internen Linux-Server oder einer VM betrieben werden.

---

# 📁 Vorgeschlagene Projektstruktur

    bullshit-bingo/
    │
    ├── app/
    │   ├── main.py
    │   ├── game.py
    │   ├── models.py
    │   ├── database.py
    │   │
    │   ├── static/
    │   │   ├── css/
    │   │   └── js/
    │   │
    │   └── templates/
    │       ├── index.html
    │       ├── game.html
    │       ├── host.html
    │       └── scoreboard.html
    │
    ├── data/
    │   └── buzzwords.json
    │
    ├── Dockerfile
    ├── docker-compose.yml
    ├── requirements.txt
    └── README.md

---

# 🔮 Mögliche Erweiterungen

Später könnten ergänzt werden:

- eigene Buzzword-Sets
- Kategorien
- verschiedene Bingo-Größen
- QR-Code-Beitritt
- Dark Mode
- Sound bei Bingo
- Animation bei Bingo
- Zuschauer-Modus
- Meeting-/Session-Historie
- Statistiken
- häufigste Buzzwords
- verschiedene Spielmodi
- Teams gegeneinander
- Admin-Oberfläche zur Begriffspflege

---

# 🎯 Ziel

Das Projekt soll aus langweiligen Meetings wenigstens einen kleinen Wettbewerb machen.

Wenn schon jemand sagt:

**„Wir müssen hier einen Deep Dive machen, um ein gemeinsames Alignment für die strategische Roadmap zu schaffen.“**

… dann sollte wenigstens jemand Punkte dafür bekommen. 😄

## Aktueller Betrieb

Die produktive Version ist ein Live-Quiz. Die Spielleitung wählt die Zahl
der Fragen, die Antwortzeit und die Richtung (Floskel, Bedeutung oder gemischt).
Ein QR-Code und ein Spielcode verbinden die Spieler mit der Runde. Der Beamer
zeigt dieselbe Frage und den Spielstand. Richtige Antworten bringen je nach
Tempo 100 bis 500 Punkte, falsche Antworten kosten 100 Punkte. Die Rangliste
wird nach jeder Auflösung aktualisiert. Abgeschlossene Quizrunden gehen in
die Gesamtwertung ein, die einen Spieler über seinen Browser wiedererkennt.
Dafür werden die Rundenpunkte durch die vorgesehene Fragenzahl geteilt
und mit zwei multipliziert. Die Gesamtwertung zeigt den Durchschnitt
dieser Werte (maximal 1.000 Punkte pro Runde). Abgebrochene Quizrunden
werden dabei ausgelassen.

Sobald alle geantwortet haben oder die Antwortzeit abläuft, zeigt das Quiz
die Lösung und zählt die beim Erstellen gewählte Pause herunter. Danach
startet die nächste Frage automatisch. Nach der letzten Frage erscheint
die Siegerehrung auf allen verbundenen Ansichten. Eigene Floskeln können
direkt auf der Startseite ergänzt werden.

`docker compose up -d --build --wait` startet den Dienst auf
`127.0.0.1:18092`. Caddy leitet HTTPS und WebSockets für
`bingo.schuelting-develop.de` dorthin weiter. Der Healthcheck liegt unter
`/health`, Runden und eigene Floskeln liegen im SQLite-Volume `game-data`.
Uvicorn läuft mit einem Worker, damit Live-Updates alle Verbindungen erreichen.
