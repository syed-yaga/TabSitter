import { Request, Response } from "express";
import prisma from "../config/prisma.js";

const DEFAULT_USER_ID = "hackathon-user";

/**
 * GET /api/projects
 * List projects and their pages using Prisma .findMany with relations.
 */
export async function listProjects(req: Request, res: Response): Promise<void> {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: DEFAULT_USER_ID },
      include: {
        savedPages: {
          orderBy: { createdAt: "desc" },
          include: {
            watches: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error: any) {
    console.error("Error in listProjects:", error);
    res.status(500).json({
      error: "Failed to retrieve projects",
      details: error.message,
    });
  }
}

/**
 * POST /api/projects
 * Create a new project cluster.
 */
export async function createProject(req: Request, res: Response): Promise<void> {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Project name is required" });
      return;
    }

    const project = await prisma.project.create({
      data: {
        userId: DEFAULT_USER_ID,
        name: name.trim(),
        description: description?.trim() || null,
      },
      include: {
        savedPages: true,
      },
    });

    res.status(201).json({
      success: true,
      project,
    });
  } catch (error: any) {
    console.error("Error in createProject:", error);
    res.status(500).json({
      error: "Failed to create project",
      details: error.message,
    });
  }
}
