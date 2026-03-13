import express from "express";
import cors from "cors";
import standingsRouter from "./routes/standings.js";
import leadersRouter from "./routes/leaders.js";
import scoresRouter from "./routes/scores.js";
import boxscoreRouter from "./routes/boxscore.js";
import teamRouter from "./routes/team.js";
import healthRouter from "./routes/health.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/standings", standingsRouter);
app.use("/api/leaders", leadersRouter);
app.use("/api/scores", scoresRouter);
app.use("/api/boxscore", boxscoreRouter);
app.use("/api/team", teamRouter);
app.use("/api/health", healthRouter);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`ECHL Dashboard API running on port ${PORT}`);
});
