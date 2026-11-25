import asyncio
import json
import random
import secrets
import time
from io import BytesIO

import qrcode
from qrcode.image.svg import SvgPathImage
import sqlite3
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
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
db.execute("CREATE TABLE IF NOT EXISTS quizzes (code TEXT PRIMARY KEY, state TEXT NOT NULL)")
db.execute("CREATE TABLE IF NOT EXISTS custom_terms (term TEXT PRIMARY KEY, meaning TEXT NOT NULL)")
words.update(db.execute("SELECT term, meaning FROM custom_terms"))
db.commit()
updates = {}


ORIGIN = "https://bingo.schuelting-develop.de"
JOKES = [
    "Das parken wir fürs nächste Alignment.",
    "Da müssen wir noch mal in den Deep Dive.",
    "Wir nehmen das als Learning mit.",
    "Spannender Impuls. Kommt auf den Parkplatz.",
    "Der Quick Win war wohl im Backlog.",
]


class Settings(BaseModel):
    rounds: Literal[5, 10, 15] = 10
    seconds: Literal[10, 15, 20, 30] = 15
    direction: Literal["meaning", "term", "mixed"] = "mixed"


class Join(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    identity: str = Field(pattern=r"^[a-f0-9-]{36}$")


class Control(BaseModel):
    token: str
    action: Literal["next", "reveal", "finish"]


class Answer(BaseModel):
    token: str
    number: int
    option: int = Field(ge=0, le=3)


class CustomTerm(BaseModel):
    token: str
    term: str = Field(min_length=1, max_length=70)
    meaning: str = Field(min_length=1, max_length=240)


def load(code):
    row = db.execute("SELECT state FROM quizzes WHERE code = ?", (code,)).fetchone()
    if row is None:
        raise HTTPException(404, "Diese Runde gibt es nicht.")
    return json.loads(row[0])


def save(code, game):
    with db:
        db.execute("INSERT OR REPLACE INTO quizzes VALUES (?, ?)", (code, json.dumps(game)))
    event = updates.get(code)
    if event:
        updates[code] = asyncio.Event()
        event.set()


def authorize(game, token):
    if not secrets.compare_digest(game["host"].encode(), token.encode()):
        raise HTTPException(403, "Nur die Spielleitung darf das.")


def phase(game, now):
    if game["status"] == "question" and now >= game["question"]["deadline"]:
        return "reveal"
    return game["status"]


def rankings(players, pending_answers):
    rows = []
    for player in players:
        row = {key: player[key] for key in ("id", "name", "points", "correct")}
        pending = pending_answers.get(player["id"])
        if pending:
            row["points"] -= pending["points"]
            row["correct"] -= int(pending["points"] > 0)
        rows.append(row)
    return sorted(rows, key=lambda p: (-p["points"], -p["correct"], p["name"].casefold()))


def public(game, player=None):
    now = time.time()
    status = phase(game, now)
    question = game["question"]
    pending_answers = question["answers"] if status == "question" else {}
    data = dict(status=status, settings=game["settings"], number=len(game["used"]),
                ranking=rankings(game["players"].values(), pending_answers), now=now)
    if player:
        data["you"] = player["id"]
    if question:
        data["question"] = {key: question[key] for key in ("prompt", "label", "choices", "deadline")}
        data["answered"] = len(question["answers"])
        if status in ("reveal", "finished"):
            data["question"]["correct"] = question["correct"]
        if player:
            data["result"] = question["answers"].get(player["id"])
    return data


def new_question(game):
    term = random.choice([word for word in words if word not in game["used"]])
    direction = game["settings"]["direction"]
    if direction == "mixed":
        direction = random.choice(("term", "meaning"))
    if direction == "meaning":
        prompt, label, correct = term, "Was heißt diese Floskel?", words[term]
        pool = list(dict.fromkeys(words.values()))
    else:
        prompt, label, correct = words[term], "Welche Floskel ist gemeint?", term
        pool = list(words)
    choices = random.sample([value for value in pool if value != correct], 3) + [correct]
    random.shuffle(choices)
    game["used"].append(term)
    game["question"] = dict(prompt=prompt, label=label, choices=choices, correct=choices.index(correct),
                            deadline=time.time() + game["settings"]["seconds"], answers={})
    game["status"] = "question"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
@app.get("/bingo/{code}")
@app.get("/join/{code}")
@app.get("/host/{code}")
@app.get("/live/{code}")
def index():
    return FileResponse("static/index.html")


@app.get("/api/ranking")
async def overall():
    totals = {}
    for (raw,) in db.execute("SELECT state FROM quizzes"):
        game = json.loads(raw)
        if game["status"] != "finished":
            continue
        for player in game["players"].values():
            if not player["attempts"]:
                continue
            key = player["identity"]
            entry = totals.setdefault(key, dict(id="", name=player["name"], points=0, correct=0, games=0))
            entry.update(name=player["name"], points=entry["points"] + player["points"],
                         correct=entry["correct"] + player["correct"], games=entry["games"] + 1)
    return [row for _, row in sorted(
        totals.items(),
        key=lambda pair: (-pair[1]["points"], -pair[1]["correct"], pair[1]["name"].casefold()),
    )][:20]


@app.post("/api/quizzes", status_code=201)
async def create(settings: Settings):
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(5))
        if not db.execute("SELECT 1 FROM quizzes WHERE code = ?", (code,)).fetchone():
            break
    host = secrets.token_urlsafe(24)
    save(code, dict(host=host, settings=settings.model_dump(), status="lobby",
                    used=[], question=None, players={}))
    return dict(code=code, token=host)


@app.get("/api/quizzes/{code}/qr.svg")
async def qr(code: str):
    load(code)
    image = qrcode.make(f"{ORIGIN}/join/{code}", image_factory=SvgPathImage)
    buffer = BytesIO()
    image.save(buffer)
    return Response(buffer.getvalue(), media_type="image/svg+xml")


@app.post("/api/quizzes/{code}/join")
async def join(code: str, body: Join):
    game = load(code)
    token = next((key for key, player in game["players"].items()
                  if player["identity"] == body.identity), None)
    if token:
        raise HTTPException(409, "Dieser Browser hat bereits einen Platz in dieser Runde.")
    if game["status"] == "finished":
        raise HTTPException(409, "Das Quiz ist bereits beendet.")
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Gib bitte einen Namen ein.")
    token = secrets.token_urlsafe(24)
    game["players"][token] = dict(id=secrets.token_hex(8), name=name, identity=body.identity,
                                  points=0, correct=0, attempts=0)
    save(code, game)
    return dict(token=token)


@app.post("/api/quizzes/{code}/control")
async def control(code: str, body: Control):
    game = load(code)
    authorize(game, body.token)
    status = phase(game, time.time())
    if body.action == "next" and status in ("lobby", "reveal"):
        if not game["players"]:
            raise HTTPException(409, "Warte, bis jemand beigetreten ist.")
        if len(game["used"]) >= game["settings"]["rounds"]:
            game["status"] = "finished"
        else:
            new_question(game)
    elif body.action == "reveal" and status == "question":
        game["status"] = "reveal"
    elif body.action == "finish" and status in ("question", "reveal"):
        game["status"] = "finished"
    else:
        raise HTTPException(409, "Diese Aktion passt gerade nicht zum Quizstand.")
    save(code, game)
    return public(game)


@app.post("/api/quizzes/{code}/answer")
async def answer(code: str, body: Answer):
    game = load(code)
    player = game["players"].get(body.token)
    if not player:
        raise HTTPException(403, "Tritt dem Quiz zuerst bei.")
    now = time.time()
    if phase(game, now) != "question" or body.number != len(game["used"]):
        raise HTTPException(409, "Die Zeit für diese Frage ist abgelaufen.")
    question = game["question"]
    if player["id"] in question["answers"]:
        raise HTTPException(409, "Deine Antwort wurde bereits gewertet.")
    correct = body.option == question["correct"]
    remaining = (question["deadline"] - now) / game["settings"]["seconds"]
    points = round(100 + 400 * min(1, remaining)) if correct else -100
    result = dict(option=body.option, points=points, joke="" if correct else random.choice(JOKES))
    question["answers"][player["id"]] = result
    player["points"] += points
    player["correct"] += int(correct)
    player["attempts"] += 1
    save(code, game)
    return result


@app.post("/api/quizzes/{code}/terms", status_code=201)
async def add_term(code: str, body: CustomTerm):
    authorize(load(code), body.token)
    term, meaning = body.term.strip(), body.meaning.strip()
    if not term or not meaning:
        raise HTTPException(400, "Gib bitte Floskel und Bedeutung ein.")
    if any(existing.casefold() == term.casefold() for existing in words):
        raise HTTPException(409, "Diese Floskel gibt es schon.")
    with db:
        db.execute("INSERT INTO custom_terms VALUES (?, ?)", (term, meaning))
    words[term] = meaning
    return {"term": term}


@app.websocket("/ws/quiz/{code}")
async def live(socket: WebSocket, code: str):
    await socket.accept()
    listener = None
    try:
        token = await asyncio.wait_for(socket.receive_text(), 10)
        load(code)
        listener = asyncio.create_task(socket.receive())
        while not listener.done():
            event = updates.setdefault(code, asyncio.Event())
            game = load(code)
            snapshot = public(game, game["players"].get(token))
            await socket.send_json(snapshot)
            timeout = None
            if snapshot["status"] == "question":
                timeout = max(0, game["question"]["deadline"] - time.time())
            change = asyncio.create_task(event.wait())
            try:
                await asyncio.wait({change, listener}, timeout=timeout, return_when=asyncio.FIRST_COMPLETED)
            finally:
                change.cancel()
    except HTTPException:
        await socket.close(4404)
    except (WebSocketDisconnect, TimeoutError, OSError):
        pass
    finally:
        if listener:
            listener.cancel()
