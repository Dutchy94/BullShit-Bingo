"use strict";

const $ = (id) => document.getElementById(id);
const path = location.pathname.split("/");
const room = /^[A-Z0-9]{5}$/i.test(path[2] || "") ? path[2].toUpperCase() : "";
const presentation = path[1] === "live";
const hostToken = room && !presentation ? localStorage.getItem("host:" + room) : "";
let playerToken = room && !presentation ? localStorage.getItem("player:" + room) : "";
let socket;
let glossary = {};
let selected = new Set();
let initialized = false;
let pending = false;
let lastBingos = 0;
let cardIdentity = "";

async function api(path, body) {
  const options = body === undefined ? {} : {
    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)
  };
  const response = await fetch("/api/" + path, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === "string" ? error.detail : "Das hat gerade nicht geklappt.");
  }
  return response.json();
}

function report(message = "") {
  $("error").textContent = message;
  $("error").hidden = !message;
}

function submit(id, callback) {
  $(id).addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    if (button) button.disabled = true;
    report();
    try {
      await callback();
    } catch (error) {
      report(error.message);
    } finally {
      if (button) button.disabled = false;
    }
  });
}

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

const gamePath = "games/" + room;
async function act(action, fields = {}, token = hostToken) {
  report();
  try {
    return await api(gamePath + "/action", {action, token, ...fields});
  } catch (error) {
    report(error.message);
    throw error;
  }
}

function showTerms() {
  const fragment = document.createDocumentFragment();
  const filter = $("filter").value.trim().toLocaleLowerCase("de");
  for (const [term, meaning] of Object.entries(glossary)) {
    if (!(term + " " + meaning).toLocaleLowerCase("de").includes(filter)) continue;
    const label = element("label");
    const input = element("input");
    input.type = "checkbox";
    input.checked = selected.has(term);
    input.onchange = () => {
      if (input.checked) selected.add(term);
      else selected.delete(term);
      countTerms();
    };
    label.append(input, document.createTextNode(term));
    fragment.append(label);
  }
  $("terms").replaceChildren(fragment);
  countTerms();
}

function countTerms() {
  $("selected").textContent = "Floskeln auswählen · " + selected.size;
}

function renderCard(data) {
  const board = $("card");
  const identity = JSON.stringify(data.card);
  if (cardIdentity !== identity) {
    cardIdentity = identity;
    $("meaning").textContent = "Tippe auf ⓘ, wenn du wissen willst, was die Floskel eigentlich heißt.";
    board.style.setProperty("--size", data.size);
    board.replaceChildren(...data.card.map(({term, meaning}, position) => {
      const tile = element("div", undefined, "tile");
      const mark = element("button", term);
      mark.onclick = async () => {
        if (pending) return;
        pending = true;
        try {
          await act("mark", {position}, playerToken);
        } catch {
          // The error has already been shown in the game.
        } finally {
          pending = false;
        }
      };
      const info = element("button", "ⓘ");
      info.setAttribute("aria-label", "Bedeutung von " + term);
      info.onclick = () => { $("meaning").textContent = term + " · " + meaning; };
      tile.append(mark, info);
      return tile;
    }));
  }
  Array.from(board.children).forEach((tile, position) => {
    const marked = data.marked.includes(position);
    tile.classList.toggle("marked", marked);
    tile.firstChild.disabled = data.status !== "running";
    tile.firstChild.setAttribute("aria-pressed", marked);
  });
}

function render(data) {
  $("room").hidden = false;
  $("status").textContent = {waiting:"Wartet auf Start", running:"Runde läuft", paused:"Pausiert"}[data.status];
  $("join-panel").hidden = presentation || Boolean(data.card);
  $("card-panel").hidden = presentation || !data.card;
  if (playerToken && !data.card) {
    localStorage.removeItem("player:" + room);
    playerToken = "";
    report("Dein Platz in dieser Runde ist nicht mehr verfügbar.");
    if (hostToken) connect();
  }
  const max = data.ranking[0];
  const leaders = max ? data.ranking.filter((p) => p.bingos === max.bingos && p.hits === max.hits) : [];
  $("count").textContent = data.ranking.length + (data.ranking.length === 1 ? " Person" : " Personen");
  $("leader").textContent = !max ? "Die Rangliste füllt sich, sobald jemand beitritt."
    : max.hits === 0 ? "Die erste Floskel ist noch offen."
    : leaders.length > 1 ? "Gleichstand an der Spitze" : "✦ " + max.name + " führt";
  let rank = 0;
  const rows = data.ranking.map((player, index) => {
    const previous = data.ranking[index - 1];
    if (!previous || previous.hits !== player.hits || previous.bingos !== player.bingos) rank = index + 1;
    const row = element("div", undefined, "rank");
    const details = element("div");
    details.append(element("strong", player.name + (data.id === player.id ? " · Du" : "")),
      element("small", player.hits + " Treffer · " + player.bingos + " Bingo"));
    row.append(element("span", "#" + rank), details);
    if (hostToken) {
      const remove = element("button", "×");
      remove.setAttribute("aria-label", player.name + " entfernen");
      remove.onclick = () => {
        if (confirm(player.name + " aus der Runde entfernen?")) {
          act("remove", {player: player.id}).catch(() => {});
        }
      };
      row.append(remove);
    }
    if (player.id === data.id) {
      $("personal").textContent = "Platz " + rank + " · " + player.hits + " Treffer · " + player.bingos + " Bingo";
      if (player.bingos > lastBingos) cheer();
      lastBingos = player.bingos;
    }
    return row;
  });
  $("ranking").replaceChildren(...rows);
  if (data.card) renderCard(data);
  if (data.host && !initialized) {
    initialized = true;
    $("size").value = data.size;
    selected = new Set(data.terms);
    showTerms();
  }
  $("settings").querySelector('button:not([type])').disabled = data.status !== "waiting";
}

function cheer() {
  $("win")?.remove();
  const toast = element("div", "✷ BINGO! Das nehmen wir mit ins nächste Meeting.", "win");
  toast.id = "win";
  toast.setAttribute("role", "status");
  document.body.append(toast);
  setTimeout(() => toast.remove(), 4200);
}

function connect() {
  if (socket) socket.close();
  const channel = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/" + room);
  socket = channel;
  channel.onopen = () => channel.send(playerToken || hostToken || "");
  channel.onmessage = (event) => {
    if (socket !== channel) return;
    $("connection").textContent = "● Live";
    render(JSON.parse(event.data));
  };
  channel.onclose = (event) => {
    if (socket !== channel) return;
    if (event.code === 4404) {
      $("connection").hidden = true;
      report("Diese Runde wurde nicht gefunden. Prüfe den Spielcode.");
      $("lobby").hidden = false;
      return;
    }
    $("connection").textContent = "Verbindung wird aufgebaut …";
    setTimeout(() => { if (socket === channel) connect(); }, 1200);
  };
}

submit("create", async () => {
  const result = await api("games", {size: Number($("create-size").value)});
  localStorage.setItem("host:" + result.code, result.token);
  location.assign("/bingo/" + result.code);
});
submit("enter", () => location.assign("/bingo/" + $("code").value.trim().toUpperCase()));
submit("join", async () => {
  const result = await api(gamePath + "/join", {name: $("name").value.trim()});
  playerToken = result.token;
  localStorage.setItem("player:" + room, playerToken);
  connect();
});
submit("settings", () => act("configure", {settings: {size: Number($("size").value), terms: [...selected]}}));
submit("add", async () => {
  glossary = await api(gamePath + "/terms", {
    token: hostToken, term: $("term").value, meaning: $("translation").value
  });
  const term = $("term").value.trim();
  selected.add(term);
  $("filter").value = "";
  $("add").reset();
  $("added").textContent = "Gespeichert. Übernimm die Floskel über die Spieleinstellungen in diese Runde.";
  showTerms();
});

$("filter").oninput = showTerms;
$("select-all").onclick = () => { selected = new Set(Object.keys(glossary)); showTerms(); };
$("select-none").onclick = () => { selected.clear(); showTerms(); };
$("share").onclick = async () => {
  const link = location.origin + "/bingo/" + room;
  try {
    await navigator.clipboard.writeText(link);
    $("share").textContent = "Link kopiert ✓";
  } catch {
    report("Einladungslink: " + link);
  }
};
document.querySelectorAll("[data-action]").forEach((button) => {
  button.onclick = () => {
    const action = button.dataset.action;
    if ((action === "reset" || action === "new") && !confirm("Spielstände für alle Teilnehmenden zurücksetzen?")) return;
    act(action).catch(() => {});
  };
});

if (!room) {
  $("lobby").hidden = false;
} else {
  document.body.classList.add("in-room");
  if (presentation) {
    document.body.classList.add("presentation");
    $("play").hidden = true;
    $("live").hidden = true;
    $("intro").textContent = "Die Live-Rangliste für den Meetingraum.";
  }
  $("room-code").textContent = room;
  $("live").href = "/live/" + room;
  $("host").hidden = !hostToken;
  $("host").open = Boolean(hostToken);
  $("connection").hidden = false;
  $("connection").textContent = "Verbindung wird aufgebaut …";
  if (hostToken) {
    api("terms").then((terms) => { glossary = terms; showTerms(); }).catch((error) => report(error.message));
    if (playerToken) {
      const admin = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/" + room);
      admin.onopen = () => admin.send(hostToken);
      admin.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.host && !initialized) {
          initialized = true;
          $("size").value = data.size;
          selected = new Set(data.terms);
          showTerms();
        }
        admin.close();
      };
    }
  }
  connect();
}
