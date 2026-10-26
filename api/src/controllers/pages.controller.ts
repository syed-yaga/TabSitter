import { Request, Response } from "express";
import prisma from "../config/prisma.js";

const DEFAULT_USER_ID = "hackathon-user";

export interface SavePagePayload {
  url: string;
  title: string;
  summary: string;
  intent?: string;
  suggestedProject?: string;
  projectId?: string;
  embedding: number[];
  status?: string;
}

/**
 * POST /api/pages
 * Saves an array of pages (or a single page) using Prisma.
 */
export async function savePages(req: Request, res: Response): Promise<void> {
  try {
    const rawBody = req.body;
    let pageItems: SavePagePayload[] = [];

    if (Array.isArray(rawBody)) {
      pageItems = rawBody;
    } else if (rawBody && Array.isArray(rawBody.pages)) {
      pageItems = rawBody.pages;
    } else if (rawBody && typeof rawBody === "object") {
      pageItems = [rawBody];
    }

    if (pageItems.length === 0) {
      res.status(400).json({ error: "No page data provided. Expecting an array or page object." });
      return;
    }

    const savedRecords = [];

    for (const item of pageItems) {
      if (!item.url || !item.title) {
        continue;
      }

      let resolvedProjectId: string | undefined = item.projectId;

      // If suggestedProject is provided and no projectId, find or create the project
      if (!resolvedProjectId && item.suggestedProject && item.suggestedProject.trim()) {
        const projectName = item.suggestedProject.trim();
        const existingProject = await prisma.project.findFirst({
          where: {
            userId: DEFAULT_USER_ID,
            name: { equals: projectName, mode: "insensitive" },
          },
        });

        if (existingProject) {
          resolvedProjectId = existingProject.id;
        } else {
          const newProject = await prisma.project.create({
            data: {
              userId: DEFAULT_USER_ID,
              name: projectName,
              description: `Auto-created cluster for ${projectName}`,
            },
          });
          resolvedProjectId = newProject.id;
        }
      }

      const saved = await prisma.savedPage.create({
        data: {
          userId: DEFAULT_USER_ID,
          url: item.url,
          title: item.title,
          summary: item.summary || "",
          intent: item.intent || null,
          projectId: resolvedProjectId || null,
          embedding: Array.isArray(item.embedding) ? item.embedding : [],
          status: item.status || "hibernating",
        },
      });

      savedRecords.push(saved);
    }

    res.status(200).json({
      success: true,
      message: `Successfully saved ${savedRecords.length} page(s)`,
      count: savedRecords.length,
      pages: savedRecords,
    });
  } catch (error: any) {
    console.error("Error in savePages:", error);
    res.status(500).json({
      error: "Failed to save pages",
      details: error.message,
    });
  }
}

/**
 * GET /api/pages
 * Lists all saved pages for the default user.
 */
export async function listPages(req: Request, res: Response): Promise<void> {
  try {
    const pages = await prisma.savedPage.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: "desc" },
      include: {
        project: true,
        watches: true,
      },
    });

    res.status(200).json({
      success: true,
      count: pages.length,
      pages,
    });
  } catch (error: any) {
    console.error("Error in listPages:", error);
    res.status(500).json({
      error: "Failed to retrieve pages",
      details: error.message,
    });
  }
}

/**
 * GET /api/pages/:id
 * Retrieve a single saved page by ID.
 */
export async function getPageById(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const page = await prisma.savedPage.findUnique({
      where: { id },
      include: { project: true, watches: true },
    });

    if (!page) {
      res.status(404).json({ error: "Page not found" });
      return;
    }

    res.status(200).json({ success: true, page });
  } catch (error: any) {
    console.error("Error in getPageById:", error);
    res.status(500).json({ error: "Failed to retrieve page", details: error.message });
  }
}

/**
 * PUT /api/pages/:id/status
 * Update the status of a saved page (e.g. to "reawakened" or "hibernating").
 */
export async function updatePageStatus(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status || typeof status !== "string") {
      res.status(400).json({ error: "Status string is required" });
      return;
    }

    const updated = await prisma.savedPage.update({
      where: { id },
      data: { status },
    });

    res.status(200).json({
      success: true,
      message: `Page status updated to ${status}`,
      page: updated,
    });
  } catch (error: any) {
    console.error("Error in updatePageStatus:", error);
    res.status(500).json({
      error: "Failed to update page status",
      details: error.message,
    });
  }
}
