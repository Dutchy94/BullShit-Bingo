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
const titles = [
  "Top Manager für heiße Luft",
  "Scrum Master fürs Stuhlkreis-Alignment",
  "Chief Officer für betreutes Nicken",
  "VP für Folien ohne Entscheidung",
  "Head of Meetings über Meetings"
];

const rankingGroups = [
  {max: 3, title: "Management", range: "Platz 1–3"},
  {max: 6, title: "Kernkompetenz", range: "Platz 4–6"},
  {max: 10, title: "Arbeitskreis ohne Auftrag", range: "Platz 7–10"},
  {max: Infinity, title: "Hoch befördern", range: "Ab Platz 11"}
];

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
  let previousGroup;
  const rows = players.flatMap((player, index) => {
    const prior = players[index - 1];
    if (!prior || prior.points !== player.points || prior.correct !== player.correct) place = index + 1;
    const mine = Boolean(you && player.id === you);
    const row = element("div", "", mine ? "rank me" : "rank");
    const info = element("div", "");
    const games = player.games === 1 ? "1 Quiz" : player.games + " Quizrunden";
    info.append(element("strong", player.name + (mine ? " · Du" : "")),
      element("small", global ? player.correct + " % richtig · " + games : player.correct + " richtig"));
    if (titles[place - 1] && (global || snapshot.status !== "lobby")) {
      info.append(element("small", titles[place - 1], "rank-title-label"));
    }
    row.append(element("span", String(place) + "."), info,
      element("strong", player.points.toLocaleString("de-DE") + " Pkt.", "points"));
    if (!global) return [row];
    const group = rankingGroups.find(({max}) => place <= max);
    if (group === previousGroup) return [row];
    previousGroup = group;
    const heading = element("h3", group.title, "rank-group-heading");
    heading.append(element("span", group.range));
    return [heading, row];
  });
  $(target).replaceChildren(...(rows.length ? rows : [
    element("p", global ? "Hier erscheinen die ersten Ergebnisse nach Quizende." : "Es ist noch niemand beigetreten.")
  ]));
}

function tick() {
  if (!snapshot?.question) return;
  const answering = snapshot.status === "question";
  const deadline = answering ? snapshot.question.deadline : snapshot.next_at;
  const seconds = deadline ? Math.max(0, deadline - Date.now() / 1000 - clockOffset) : 0;
  const final = snapshot.number === snapshot.settings.rounds;
  $("timer").textContent = answering ? Math.ceil(seconds) + " Sek."
    : (final ? "Siegerehrung in " : "Nächste Frage in ") + Math.ceil(seconds) + " Sek.";
  $("timer-bar").max = answering ? snapshot.settings.seconds : (snapshot.settings.pause || 5);
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
    const winners = data.winners;
    $("award-title").textContent = winners.length ? "Daily Sprint Master" : "Meeting beendet";
    $("award-note").hidden = !winners.length;
    $("finished").classList.toggle("celebrating", winners.length > 0);
    $("winner").textContent = winners.length
      ? winners.map((player) => player.name).join(" & ") + " · " + winners[0].points + " Rundenpunkte"
      : "In dieser Runde wurde keine Antwort abgegeben.";
    if (winners.length && !$("confetti").childElementCount) {
      for (let i = 0; i < 28; i++) {
        const piece = element("i", "");
        piece.style.setProperty("--x", (i * 37 % 100) + "%");
        piece.style.setProperty("--delay", (i % 7) * 0.09 + "s");
        piece.style.setProperty("--hue", String(i * 61 % 360));
        $("confetti").append(piece);
      }
    }
  }
  $("next").hidden = !lobby;
  $("next").disabled = !data.ranking.length;
  $("next").textContent = "Quiz starten";
  $("reveal").hidden = !questionOpen;
  $("finish").hidden = lobby;
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

const reportReplies = {
  decisions: [
    "Beschluss vertagt. Die Folie bleibt im Deck.",
    "Stand heute: drei Beschlussvorlagen, null Beschlüsse.",
    "Der Lenkungskreis hat entschieden, die Entscheidung zu delegieren."
  ],
  meeting: [
    "Der Termin zur Terminfindung wurde verschoben. Ersatztermin folgt nach Abstimmung.",
    "Einladung versendet. Teilnehmerkreis wird im Vorgespräch geklärt.",
    "Raum gebucht: Druckernische B. Agenda folgt als PDF."
  ]
};
document.querySelectorAll("[data-report]").forEach((button) => {
  let next = 0;
  button.onclick = () => {
    const replies = reportReplies[button.dataset.report];
    $("report-reply").textContent = replies[next];
    $("report-reply").hidden = false;
    next = (next + 1) % replies.length;
  };
});

const approval = $("approval-dialog");
const approvals = [...$("approval-checks").querySelectorAll("input")];
const approvalVetoes = {
  department: "Abteilungsleitung: Für ein Projekt brauche ich einen Business Case. Bitte in Excel, damit wir ihn als PDF ablegen können.",
  it: "IT: Für ein Projekt brauche ich ein Ticket. Pflichtfeld im Ticket: der Quizcode des noch zu erstellenden Quiz.",
  project: "Projektbüro: Für ein Projekt brauche ich einen Auftrag. Ohne Quizcode darf ich ihn nur als Entwurf nummerieren."
};
let vetoes = 0;

form("create", () => {
  vetoes = 0;
  approvals.forEach((checkbox) => { checkbox.checked = false; });
  $("approval-checks").hidden = false;
  $("approval-veto").textContent = "";
  $("approval-bypass").hidden = true;
  $("approval-yes").hidden = true;
  $("approval-no").textContent = "Abbrechen";
  approval.showModal();
});

for (const checkbox of approvals) {
  checkbox.onchange = () => {
    if (!checkbox.checked || approvals.filter((item) => item.checked).length < 2) return;
    checkbox.checked = false;
    vetoes += 1;
    $("approval-veto").textContent = (vetoes === 1 ? "Veto – " : "Zweites Veto – ")
      + approvalVetoes[checkbox.value];
    if (vetoes === 2) {
      $("approval-checks").hidden = true;
      $("approval-bypass").hidden = false;
      $("approval-yes").hidden = false;
      $("approval-no").textContent = "Nein";
      $("approval-no").focus();
    }
  };
}

$("approval-no").onclick = () => approval.close();
$("approval-yes").onclick = async () => {
  approval.close();
  const button = $("create").querySelector("button");
  const progress = $("create-progress");
  button.disabled = true;
  progress.textContent = "Warten auf IT-Freigabe …";
  progress.hidden = false;
  try {
    const [data] = await Promise.all([
      api("quizzes", {
        rounds: Number($("rounds").value), seconds: Number($("seconds").value),
        pause: Number($("pause").value), direction: $("direction").value
      }),
      new Promise((resolve) => setTimeout(resolve, 650))
    ]);
    localStorage.setItem("quiz-host:" + data.code, data.token);
    location.assign("/host/" + data.code);
  } catch (failure) {
    error(failure.message);
  } finally {
    progress.hidden = true;
    button.disabled = false;
  }
};
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
form("add-home", async () => {
  const data = await api("terms", {term: $("home-term").value, meaning: $("home-meaning").value});
  $("add-home").reset();
  $("home-added").textContent = "Im Quiz-Pool gespeichert: " + data.term + ". Das Wording ist damit offiziell im Umlauf.";
  $("home-added").hidden = false;
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
    if (action === "finish" && !confirm("Quiz abbrechen? Diese Runde zählt dann nicht für die Gesamtwertung.")) return;
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
