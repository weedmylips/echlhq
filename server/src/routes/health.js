import { Router } from "express";
import { getCacheStatus } from "../config/cache.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    cache: getCacheStatus(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
