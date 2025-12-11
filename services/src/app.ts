import express from "express";
import cors from "cors";
import { handleGetRepo, handlePostRepo } from "./services/repos.service.js";
import { handleGetScans } from "./services/scans.service.js";

export const app = express();

app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.json());

app.post("/repos", handlePostRepo);
app.get("/repos", handleGetRepo);
app.get("/scans", handleGetScans);

