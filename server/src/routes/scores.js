import { Router } from "express";
import { fetchScores } from "../scrapers/dailyReport.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const data = await fetchScores();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
