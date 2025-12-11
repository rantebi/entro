import express from "express";
import { handleGetRepo, handlePostRepo } from "./repos.js";
import { handleGetScans } from "./scans.js";

export const app = express();

app.use(express.json());

app.post("/repos", handlePostRepo);
app.get("/repos", handleGetRepo);
app.get("/scans", handleGetScans);

