// routes/autoRouter.js
const express = require("express");
const { Worker } = require("worker_threads");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const API_JSON_PATH = path.resolve(__dirname, "../public/data/WebSquareAPI.json");
const WORKER_PATH = path.resolve(__dirname, "../public/worker/autoWorker.js");

/**
 * WebSquareAPI.json 에 있는 정보를 파싱하여 자동완성 처리합니다.
 * 해당 작업은 worker 쓰레드에서 작업을 진행합니다.
 */
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
