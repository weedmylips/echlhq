import { Router } from "express";
import { fetchBoxscore } from "../scrapers/boxscore.js";

const router = Router();

router.get("/:gameId", async (req, res) => {
  const { gameId } = req.params;
  if (!gameId || !/^\d+$/.test(gameId)) {
    return res.status(400).json({ error: "Invalid gameId" });
  }
  try {
    const data = await fetchBoxscore(gameId);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
