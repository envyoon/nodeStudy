// routes/autoRouter.js
const express = require("express");
const { Worker } = require("worker_threads");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// API JSON 파일 (원하면 경로 바꿔도 됨)
const API_JSON_PATH = path.resolve(__dirname, "../public/data/WebSquareAPI.json");
// 워커 파일
const WORKER_PATH = path.resolve(__dirname, "../public/worker/autoWorker.js");

router.get("/ping", (req, res) => res.json({ ok: true }));

router.post("/suggest", (req, res) => {
  const key = (req.body && req.body.key) || "";

  fs.readFile(API_JSON_PATH, "utf8", (err, data) => {
    if (err) {
      console.warn("[auto] json load error:", err.message);
      return res.json({ result: {} });
    }

    const worker = new Worker(WORKER_PATH);

    worker.once("message", (result) => {
      res.status(200).json(result);
    });

    worker.once("error", (e) => {
      console.error("[auto] worker error:", e);
      res.json({ result: {} });
    });

    worker.once("exit", () => {});

    worker.postMessage({
      apiJson: data,
      body: { key },
    });
  });
});

module.exports = router;
