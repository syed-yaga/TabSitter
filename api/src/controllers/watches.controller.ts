import { Request, Response } from "express";
import prisma from "../config/prisma.js";

const DEFAULT_USER_ID = "hackathon-user";

/**
 * POST /api/watches
 * Creates a PageWatch entry for monitoring a saved page.
 */
export async function createWatch(req: Request, res: Response): Promise<void> {
  try {
    const { savedPageId, targetIntent, cronSchedule } = req.body;

    if (!savedPageId || !targetIntent) {
      res.status(400).json({ error: "savedPageId and targetIntent are required" });
      return;
    }

    const page = await prisma.savedPage.findUnique({
      where: { id: savedPageId },
    });

    if (!page) {
      res.status(404).json({ error: "Saved page not found" });
      return;
    }

    const watch = await prisma.pageWatch.create({
      data: {
        userId: DEFAULT_USER_ID,
        savedPageId,
        targetIntent: targetIntent.trim(),
        cronSchedule: cronSchedule || "0 * * * *", // default hourly
      },
      include: {
        savedPage: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Watch created successfully",
      watch,
    });
  } catch (error: any) {
    console.error("Error in createWatch:", error);
    res.status(500).json({
      error: "Failed to create watch",
      details: error.message,
    });
  }
}

/**
 * GET /api/watches
 * Lists all active watches.
 */
export async function listWatches(req: Request, res: Response): Promise<void> {
  try {
    const watches = await prisma.pageWatch.findMany({
      where: { userId: DEFAULT_USER_ID },
      include: {
        savedPage: true,
      },
    });

    res.status(200).json({
      success: true,
      count: watches.length,
      watches,
    });
  } catch (error: any) {
    console.error("Error in listWatches:", error);
    res.status(500).json({
      error: "Failed to list watches",
      details: error.message,
    });
  }
}
