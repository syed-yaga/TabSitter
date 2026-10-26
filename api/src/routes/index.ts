import { Router } from "express";
import {
  savePages,
  listPages,
  getPageById,
  updatePageStatus,
} from "../controllers/pages.controller.js";
import {
  listProjects,
  createProject,
} from "../controllers/projects.controller.js";
import { searchPages } from "../controllers/search.controller.js";
import { createWatch, listWatches } from "../controllers/watches.controller.js";

const router = Router();

// Page routes
router.post("/pages", savePages);
router.get("/pages", listPages);
router.get("/pages/:id", getPageById);
router.put("/pages/:id/status", updatePageStatus);

// Project routes
router.get("/projects", listProjects);
router.post("/projects", createProject);

// Semantic Vector Search route
router.post("/search", searchPages);

// Page Watch routes
router.post("/watches", createWatch);
router.get("/watches", listWatches);

export default router;
