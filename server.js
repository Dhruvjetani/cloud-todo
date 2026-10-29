const express = require("express");
const os = require("os");
const path = require("path");
const storage = require("./storage");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Run storage operations one at a time so two requests never overwrite each other.
let queue = Promise.resolve();
function withTasks(fn) {
  const run = queue.then(async () => {
    const tasks = await storage.read();
    const result = await fn(tasks);
    await storage.write(tasks);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Storage error. Check the server logs." });
    }
  };
}

// Health check: used to confirm the app is running (and by load balancers).
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Basic resource information shown in the page footer.
app.get("/api/info", (req, res) => {
  res.json({
    storage: storage.mode,
    host: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    memoryUsedMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    memoryTotalMB: Math.round(os.totalmem() / 1024 / 1024),
  });
});

app.get("/api/tasks", handle(async (req, res) => {
  res.json(await storage.read());
}));

app.post("/api/tasks", handle(async (req, res) => {
  const text = String(req.body.text || "").trim().slice(0, 120);
  if (!text) return res.status(400).json({ error: "Task text is required." });
  const task = await withTasks(tasks => {
    const t = { id: Date.now(), text, done: false };
    tasks.unshift(t);
    return t;
  });
  res.status(201).json(task);
}));

app.patch("/api/tasks/:id", handle(async (req, res) => {
  const id = Number(req.params.id);
  const task = await withTasks(tasks => {
    const t = tasks.find(x => x.id === id);
    if (!t) return null;
    if (typeof req.body.done === "boolean") t.done = req.body.done;
    if (typeof req.body.text === "string" && req.body.text.trim()) {
      t.text = req.body.text.trim().slice(0, 120);
    }
    return t;
  });
  if (!task) return res.status(404).json({ error: "Task not found." });
  res.json(task);
}));

app.delete("/api/tasks/:id", handle(async (req, res) => {
  const id = Number(req.params.id);
  await withTasks(tasks => {
    const i = tasks.findIndex(x => x.id === id);
    if (i !== -1) tasks.splice(i, 1);
  });
  res.status(204).end();
}));

// Remove all completed tasks.
app.delete("/api/tasks", handle(async (req, res) => {
  await withTasks(tasks => {
    const remaining = tasks.filter(t => !t.done);
    tasks.length = 0;
    tasks.push(...remaining);
  });
  res.status(204).end();
}));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`To-do app running on port ${PORT}`);
  console.log(`Storage: ${storage.mode}`);
});
