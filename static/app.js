"use strict";

const $ = (id) => document.getElementById(id);
const [, route, rawCode] = location.pathname.split("/");
const code = /^[A-Z0-9]{5}$/i.test(rawCode || "") ? rawCode.toUpperCase() : "";
const base = "quizzes/" + code;
const beam = route === "live";
const hostToken = code ? localStorage.getItem("quiz-host:" + code) : "";
const host = route === "host" && Boolean(hostToken);
let playerToken = code ? localStorage.getItem("quiz-player:" + code) : "";
let socket, snapshot, pending = false, clockOffset = 0, choiceKey = "";

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function error(message = "") {
  $("error").textContent = message;
  $("error").hidden = !message;
}

async function api(path, payload) {
  const response = await fetch("/api/" + path, payload === undefined ? {} : {
    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Das hat gerade nicht geklappt.");
  return data;
}

function form(id, handler) {
  $(id).onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter;
    if (button) button.disabled = true;
    error();
    try { await handler(); }
    catch (failure) { error(failure.message); }
    finally { if (button) button.disabled = false; }
  };
}

function renderRanking(target, players, you, global = false) {
  let place = 0;
  const rows = players.map((player, index) => {
    const prior = players[index - 1];
    if (!prior || prior.points !== player.points || prior.correct !== player.correct) place = index + 1;
    const mine = Boolean(you && player.id === you);
    const row = element("div", "", mine ? "rank me" : "rank");
    const info = element("div", "");
    const games = player.games === 1 ? "1 Quiz" : player.games + " Quizrunden";
    info.append(element("strong", player.name + (mine ? " · Du" : "")),
      element("small", player.correct + " richtig" + (global ? " · " + games : "")));
    row.append(element("span", String(place) + "."), info,
      element("strong", player.points.toLocaleString("de-DE") + " Pkt.", "points"));
    return row;
  });
  $(target).replaceChildren(...(rows.length ? rows : [
    element("p", global ? "Hier erscheinen die ersten Ergebnisse nach Quizende." : "Es ist noch niemand beigetreten.")
  ]));
}

function tick() {
  if (!snapshot?.question) return;
  const seconds = snapshot.status === "question"
    ? Math.max(0, snapshot.question.deadline - Date.now() / 1000 - clockOffset) : 0;
  $("timer").textContent = snapshot.status === "question" ? Math.ceil(seconds) + " Sek." : "Auflösung";
  $("timer-bar").max = snapshot.settings.seconds;
  $("timer-bar").value = seconds;
  if (seconds === 0) {
    $("choices").querySelectorAll("button").forEach((button) => { button.disabled = true; });
  }
}

function renderQuestion(data) {
  const question = data.question;
  $("question-number").textContent = "Frage " + data.number + " / " + data.settings.rounds;
  $("question-label").textContent = question.label;
  $("prompt").textContent = question.prompt;
  const key = data.number + ":" + data.status + ":" + (data.result?.option ?? "");
  if (choiceKey !== key) {
    choiceKey = key;
    $("choices").replaceChildren(...question.choices.map((choice, index) => {
      const canAnswer = Boolean(data.you && data.status === "question" && !data.result);
      const button = element(canAnswer ? "button" : "div", "", "choice");
      button.append(element("span", "ABCD"[index]), document.createTextNode(choice));
      if (canAnswer) button.onclick = () => answer(index);
      if (question.correct === index) button.classList.add("correct");
      if (data.result?.option === index) {
        button.classList.add(data.result.points < 0 ? "wrong" : "selected");
        button.append(element("span", " · Deine Wahl"));
      }
      return button;
    }));
  }
  const feedback = $("feedback");
  feedback.hidden = !data.result && !(data.you && data.status === "reveal");
  feedback.classList.toggle("wrong", data.result?.points < 0);
  feedback.textContent = data.result
    ? (data.result.points < 0 ? "−100 Punkte. " + data.result.joke : "+" + data.result.points + " Punkte. Quick Win!")
    : "Zeit abgelaufen. Für diese Frage gibt’s 0 Punkte.";
  tick();
}

function render(data) {
  snapshot = data;
  clockOffset = data.now - Date.now() / 1000;
  $("room").hidden = false;
  const lobby = data.status === "lobby";
  const finished = data.status === "finished";
  const finalQuestion = data.number >= data.settings.rounds;
  const questionOpen = data.status === "question";
  const observer = host || beam;
  const signedIn = Boolean(data.you);
  $("invite").hidden = !(lobby && observer);
  $("join-panel").hidden = observer || signedIn || finished;
  $("waiting").hidden = !(lobby && signedIn && !observer);
  $("question-panel").hidden = !data.question || !(observer || signedIn) || finished;
  $("finished").hidden = !finished;
  $("controls").hidden = !host || finished;
  $("custom").hidden = !host;
  if (!$("question-panel").hidden) renderQuestion(data);
  if (finished) {
    const lead = data.ranking[0];
    const winners = lead ? data.ranking.filter((p) => p.points === lead.points && p.correct === lead.correct) : [];
    $("winner").textContent = lead
      ? winners.map((player) => player.name).join(", ") + " · " + lead.points + " Punkte"
      : "In dieser Runde wurden keine Punkte gesammelt.";
  }
  $("next").hidden = questionOpen;
  $("next").disabled = !data.ranking.length;
  $("next").textContent = lobby ? "Erste Frage starten" : finalQuestion ? "Ergebnis veröffentlichen" : "Nächste Frage";
  $("reveal").hidden = !questionOpen;
  $("finish").hidden = lobby || (finalQuestion && !questionOpen);
  $("answers-count").textContent = lobby ? "" : data.answered + " / " + data.ranking.length + " haben geantwortet";
  $("count").textContent = data.ranking.length + (data.ranking.length === 1 ? " Person" : " Personen");
  renderRanking("ranking", data.ranking, data.you);
}

async function answer(option) {
  if (pending || snapshot.status !== "question") return;
  pending = true;
  const number = snapshot.number;
  $("choices").querySelectorAll("button").forEach((button) => { button.disabled = true; });
  error();
  try {
    const result = await api(base + "/answer", {token: playerToken, number, option});
    if (snapshot.number === number && !snapshot.result) render({...snapshot, result});
  } catch (failure) {
    error(failure.message);
    $("choices").querySelectorAll("button").forEach((button) => { button.disabled = false; });
    tick();
  } finally { pending = false; }
}

function connect() {
  if (socket) socket.close();
  const channel = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/quiz/" + code);
  socket = channel;
  channel.onopen = () => channel.send(host || beam ? "" : playerToken || "");
  channel.onmessage = (message) => {
    if (socket !== channel) return;
    $("connection").textContent = "● Live";
    render(JSON.parse(message.data));
  };
  channel.onclose = (event) => {
    if (socket !== channel) return;
    if (event.code === 4404) {
      $("connection").hidden = true;
      error("Quiz nicht gefunden. Prüfe den Spielcode oder bitte die Spielleitung um einen neuen Link.");
      return;
    }
    $("connection").textContent = "Verbindung wird wiederhergestellt …";
    setTimeout(() => { if (socket === channel) connect(); }, 1200);
  };
}

form("create", async () => {
  const data = await api("quizzes", {
    rounds: Number($("rounds").value), seconds: Number($("seconds").value), direction: $("direction").value
  });
  localStorage.setItem("quiz-host:" + data.code, data.token);
  location.assign("/host/" + data.code);
});
form("enter", () => location.assign("/join/" + $("code").value.trim().toUpperCase()));
form("join", async () => {
  let identity = localStorage.getItem("quiz-identity");
  if (!identity) {
    identity = crypto.randomUUID();
    localStorage.setItem("quiz-identity", identity);
  }
  const data = await api(base + "/join", {name: $("name").value.trim(), identity});
  playerToken = data.token;
  localStorage.setItem("quiz-player:" + code, playerToken);
  connect();
});
form("add", async () => {
  const data = await api(base + "/terms", {
    token: hostToken, term: $("term").value, meaning: $("meaning").value
  });
  $("add").reset();
  $("added").textContent = "Gespeichert: " + data.term;
});
for (const action of ["next", "reveal", "finish"]) {
  $(action).onclick = async () => {
    if (action === "finish" && !confirm("Dieses Quiz beenden und das Ergebnis veröffentlichen?")) return;
    const button = $(action);
    button.disabled = true;
    error();
    try { render(await api(base + "/control", {token: hostToken, action})); }
    catch (failure) { error(failure.message); }
    finally { button.disabled = false; }
  };
}

if (!code) {
  $("home").hidden = false;
  api("ranking").then((players) => renderRanking("overall", players, "", true)).catch((failure) => error(failure.message));
} else if (hostToken && !host && !beam) {
  location.replace("/host/" + code);
} else if (route === "host" && !host) {
  error("Die Spielleitung ist an den Browser gebunden, in dem das Quiz erstellt wurde.");
} else {
  if (beam) document.body.classList.add("beam");
  $("role").textContent = host ? "Spielleitung" : beam ? "Beamer-Ansicht" : "Mitspielen";
  $("room-title").textContent = "Quiz " + code;
  $("connection").hidden = false;
  $("connection").textContent = "Verbindung wird aufgebaut …";
  $("beam-link").href = "/live/" + code;
  $("beam-link").hidden = !host;
  $("room-code").textContent = code;
  $("qr").src = "/api/" + base + "/qr.svg";
  $("copy").onclick = async () => {
    const link = location.origin + "/join/" + code;
    try {
      await navigator.clipboard.writeText(link);
      $("copy").textContent = "Link kopiert ✓";
    } catch {
      error("Einladungslink: " + link);
    }
  };
  connect();
  setInterval(tick, 150);
}
