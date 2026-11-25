import asyncio
import json
import random
import secrets
import sqlite3
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
words = dict(
    tuple(cell.strip() for cell in line.strip("|").split("|", 1))
    for line in Path("begriffe.md").read_text().splitlines()
    if line.startswith("| ") and not line.startswith("| Floskel |")
)
db = sqlite3.connect("/data/bingo.sqlite3")
db.execute("CREATE TABLE IF NOT EXISTS games (code TEXT PRIMARY KEY, state TEXT NOT NULL)")
db.execute("CREATE TABLE IF NOT EXISTS custom_terms (term TEXT PRIMARY KEY, meaning TEXT NOT NULL)")
words.update(db.execute("SELECT term, meaning FROM custom_terms"))
db.commit()
updates = {}


class Settings(BaseModel):
    size: Literal[3, 4, 5] = 5
    terms: list[str] = Field(default_factory=lambda: list(words), max_length=5000)


class Join(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class Action(BaseModel):
    token: str = Field(max_length=64)
    action: Literal["start", "pause", "reset", "new", "remove", "configure", "mark"]
    position: int = -1
    player: str = ""
    settings: Settings | None = None


def load(code):
    row = db.execute("SELECT state FROM games WHERE code = ?", (code,)).fetchone()
    if row is None:
        raise HTTPException(404, "Runde nicht gefunden")
    return json.loads(row[0])


def save(code, game):
    with db:
        db.execute("INSERT OR REPLACE INTO games VALUES (?, ?)", (code, json.dumps(game)))
    event = updates.get(code)
    if event:
        updates[code] = asyncio.Event()
        event.set()


def configure(game, settings):
    pool = list(dict.fromkeys(settings.terms))
    if len(pool) < settings.size ** 2 or any(term not in words for term in pool):
        raise HTTPException(400, "Bitte genügend gültige Begriffe auswählen.")
    game.update(size=settings.size, terms=pool)
    for player in game["players"].values():
        deal(game, player)


def deal(game, player):
    player.update(card=random.sample(game["terms"], game["size"] ** 2), marked=[])


def score(player, size):
    marked = set(player["marked"])
    lines = [
        *[range(row * size, (row + 1) * size) for row in range(size)],
        *[range(col, size * size, size) for col in range(size)],
        [i * size + i for i in range(size)],
        [i * size + size - 1 - i for i in range(size)],
    ]
    return len(marked), sum(marked.issuperset(line) for line in lines)


def view(game, token):
    ranking = []
    for player in game["players"].values():
        hits, bingos = score(player, game["size"])
        ranking.append(dict(id=player["id"], name=player["name"], hits=hits, bingos=bingos))
    ranking.sort(key=lambda p: (-p["bingos"], -p["hits"], p["name"].casefold()))
    player = game["players"].get(token)
    host = bool(token) and secrets.compare_digest(token.encode(), game["host"].encode())
    result = dict(status=game["status"], size=game["size"], ranking=ranking, host=host)
    if host:
        result["terms"] = game["terms"]
    if player:
        result.update(id=player["id"], marked=player["marked"],
                      card=[dict(term=term, meaning=words[term]) for term in player["card"]])
    return result


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
@app.get("/bingo/{code}")
@app.get("/live/{code}")
def index():
    return FileResponse("static/index.html")


@app.get("/api/terms")
async def terms():
    return words


class CustomTerm(BaseModel):
    token: str = Field(max_length=64)
    term: str = Field(min_length=1, max_length=70)
    meaning: str = Field(min_length=1, max_length=240)


@app.post("/api/games/{code}/terms", status_code=201)
async def add_term(code: str, body: CustomTerm):
    game = load(code)
    if not secrets.compare_digest(body.token.encode(), game["host"].encode()):
        raise HTTPException(403, "Nur der Host darf Floskeln hinzufügen.")
    term, meaning = body.term.strip(), body.meaning.strip()
    if not term or not meaning:
        raise HTTPException(400, "Bitte Floskel und Bedeutung eingeben.")
    if any(existing.casefold() == term.casefold() for existing in words):
        raise HTTPException(409, "Diese Floskel gibt es schon.")
    with db:
        db.execute("INSERT INTO custom_terms VALUES (?, ?)", (term, meaning))
    words[term] = meaning
    return words


@app.post("/api/games", status_code=201)
async def create(settings: Settings):
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(5))
        if not db.execute("SELECT 1 FROM games WHERE code = ?", (code,)).fetchone():
            break
    host = secrets.token_urlsafe(24)
    game = dict(host=host, status="waiting", players={})
    configure(game, settings)
    save(code, game)
    return dict(code=code, token=host)


@app.post("/api/games/{code}/join")
async def join(code: str, body: Join):
    game = load(code)
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Bitte einen Namen eingeben.")
    token = secrets.token_urlsafe(24)
    player = dict(id=secrets.token_hex(8), name=name)
    deal(game, player)
    game["players"][token] = player
    save(code, game)
    return dict(token=token)


@app.post("/api/games/{code}/action")
async def action(code: str, body: Action):
    game = load(code)
    if body.action == "mark":
        player = game["players"].get(body.token)
        if not player:
            raise HTTPException(403, "Bitte der Runde beitreten.")
        if game["status"] != "running":
            raise HTTPException(409, "Die Runde läuft gerade nicht.")
        if not 0 <= body.position < len(player["card"]):
            raise HTTPException(400, "Ungültiges Feld.")
        marked = player["marked"]
        if body.position in marked:
            marked.remove(body.position)
        else:
            marked.append(body.position)
    else:
        if not secrets.compare_digest(body.token.encode(), game["host"].encode()):
            raise HTTPException(403, "Nur der Host darf das.")
        if body.action == "configure":
            if game["status"] != "waiting" or body.settings is None:
                raise HTTPException(409, "Einstellungen sind vor dem Start verfügbar.")
            configure(game, body.settings)
        elif body.action == "remove":
            game["players"] = {key: p for key, p in game["players"].items() if p["id"] != body.player}
        elif body.action in ("reset", "new"):
            game["status"] = "waiting"
            for player in game["players"].values():
                if body.action == "new":
                    deal(game, player)
                else:
                    player["marked"] = []
        else:
            game["status"] = "running" if body.action == "start" else "paused"
    save(code, game)
    return view(game, body.token)


@app.websocket("/ws/{code}")
async def live(socket: WebSocket, code: str):
    await socket.accept()
    listener = None
    try:
        token = await asyncio.wait_for(socket.receive_text(), 10)
        load(code)
        listener = asyncio.create_task(socket.receive())
        while not listener.done():
            event = updates.setdefault(code, asyncio.Event())
            await socket.send_json(view(load(code), token))
            change = asyncio.create_task(event.wait())
            try:
                await asyncio.wait({change, listener}, return_when=asyncio.FIRST_COMPLETED)
            finally:
                change.cancel()
    except HTTPException:
        await socket.close(4404)
    except (WebSocketDisconnect, TimeoutError, OSError):
        pass
    finally:
        if listener:
            listener.cancel()
