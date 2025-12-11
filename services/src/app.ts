import express from "express";
import { handleGetRepo, handlePostRepo } from "./services/repos.service.js";
import { handleGetScans } from "./services/scans.service.js";

export const app = express();

app.use(express.json());

app.post("/repos", handlePostRepo);
app.get("/repos", handleGetRepo);
app.get("/scans", handleGetScans);

