const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");
const emptyMsg = document.getElementById("empty");
const summary = document.getElementById("summary");
const errorEl = document.getElementById("error");
const clearBtn = document.getElementById("clear-done");
const infoEl = document.getElementById("info");
const filterBtns = document.querySelectorAll(".filter");

let tasks = [];
let filter = "all";

// Send a request to the server and return the JSON result.
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

// Run an action, show any error, then refresh the list from the server.
async function run(action) {
  try {
    errorEl.textContent = "";
    await action();
    tasks = await api("/api/tasks");
  } catch (err) {
    errorEl.textContent = err.message;
  }
  render();
}

function startEdit(li, task) {
  const textEl = li.querySelector(".text");
  const editor = document.createElement("input");
  editor.type = "text";
  editor.className = "edit-input";
  editor.value = task.text;
  editor.maxLength = 120;
  textEl.replaceWith(editor);
  editor.focus();
  editor.select();

  let finished = false;
  const finish = save => {
    if (finished) return;
    finished = true;
    const text = editor.value.trim();
    if (save && text && text !== task.text) {
      run(() => api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ text }) }));
    } else {
      render();
    }
  };
  editor.addEventListener("keydown", e => {
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  editor.addEventListener("blur", () => finish(true));
}

function visibleTasks() {
  if (filter === "active") return tasks.filter(t => !t.done);
  if (filter === "done") return tasks.filter(t => t.done);
  return tasks;
}

function render() {
  list.innerHTML = "";

  visibleTasks().forEach(task => {
    const li = document.createElement("li");
    li.className = "task" + (task.done ? " done" : "");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = task.done;
    check.setAttribute("aria-label", "Mark as done");
    check.addEventListener("change", () =>
      run(() => api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: check.checked }) }))
    );

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = task.text;
    text.title = "Double-click to edit";
    text.addEventListener("dblclick", () => startEdit(li, task));

    const del = document.createElement("button");
    del.className = "delete";
    del.type = "button";
    del.textContent = "×";
    del.setAttribute("aria-label", "Delete task");
    del.addEventListener("click", () => run(() => api(`/api/tasks/${task.id}`, { method: "DELETE" })));

    li.append(check, text, del);
    list.appendChild(li);
  });

  const remaining = tasks.filter(t => !t.done).length;
  summary.textContent = tasks.length === 0
    ? "No tasks yet"
    : remaining === 0
      ? "All done. Nice work."
      : `${remaining} ${remaining === 1 ? "task" : "tasks"} left`;

  emptyMsg.hidden = visibleTasks().length > 0;
  clearBtn.hidden = !tasks.some(t => t.done);
}

async function loadInfo() {
  try {
    const i = await api("/api/info");
    const h = Math.floor(i.uptimeSeconds / 3600);
    const m = Math.floor((i.uptimeSeconds % 3600) / 60);
    infoEl.innerHTML = "";
    [
      `Storage: ${i.storage}`,
      `Server: ${i.host} (${i.platform}), Node ${i.node}`,
      `Memory: ${i.memoryUsedMB} MB used of ${i.memoryTotalMB} MB`,
      `Uptime: ${h}h ${m}m`,
    ].forEach(line => {
      const div = document.createElement("div");
      div.textContent = line;
      infoEl.appendChild(div);
    });
  } catch {
    infoEl.textContent = "Server details unavailable.";
  }
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  run(() => api("/api/tasks", { method: "POST", body: JSON.stringify({ text }) }));
  input.focus();
});

filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    filterBtns.forEach(b => b.classList.toggle("active", b === btn));
    render();
  });
});

clearBtn.addEventListener("click", () => run(() => api("/api/tasks", { method: "DELETE" })));

run(() => Promise.resolve());
loadInfo();
setInterval(loadInfo, 30000);
