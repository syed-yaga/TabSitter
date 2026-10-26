import { Request, Response } from "express";
import prisma from "../config/prisma.js";

const EXPECTED_DIMENSIONS = 768; // nomic-embed-text embedding dimension
const DEFAULT_USER_ID = "hackathon-user";

/**
 * Calculates in-memory cosine similarity between two numeric vectors.
 * Used as a fallback if the MongoDB Atlas Vector Search index is not yet built.
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * POST /api/search
 * Accepts an embedding vector (768 dimensions).
 * CRITICAL: Uses prisma.savedPage.aggregateRaw() to execute a MongoDB $vectorSearch
 * pipeline on the `embedding` field using cosine similarity, returning the top 5 results.
 */
export async function searchPages(req: Request, res: Response): Promise<void> {
  try {
    const rawVector = req.body.embedding || req.body.queryVector;

    if (!rawVector || !Array.isArray(rawVector)) {
      res.status(400).json({
        error: "Missing or invalid 'embedding' array in request body.",
      });
      return;
    }

    const embedding: number[] = rawVector.map((n: any) => Number(n));

    if (embedding.length !== EXPECTED_DIMENSIONS) {
      console.warn(
        `Received embedding of length ${embedding.length}, expected ${EXPECTED_DIMENSIONS} dimensions (nomic-embed-text).`
      );
    }

    // CRITICAL: MongoDB Atlas $vectorSearch pipeline executed via prisma.savedPage.aggregateRaw()
    const vectorSearchPipeline = [
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: embedding,
          numCandidates: 50,
          limit: 5,
          similarity: "cosine",
        },
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          url: 1,
          title: 1,
          summary: 1,
          intent: 1,
          status: 1,
          projectId: 1,
          createdAt: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    try {
      const rawResults = (await prisma.savedPage.aggregateRaw({
        pipeline: vectorSearchPipeline as any,
      })) as unknown as any[];

      if (Array.isArray(rawResults)) {
        const formatted = rawResults.map((doc: any) => ({
          id: doc._id?.["$oid"] || doc._id?.toString() || doc._id,
          userId: doc.userId,
          url: doc.url,
          title: doc.title,
          summary: doc.summary,
          intent: doc.intent,
          status: doc.status,
          projectId: doc.projectId?.["$oid"] || doc.projectId?.toString() || doc.projectId,
          createdAt: doc.createdAt?.["$date"] || doc.createdAt,
          score: doc.score || 0,
        }));

        res.status(200).json({
          success: true,
          method: "atlas_vector_search",
          count: formatted.length,
          results: formatted,
        });
        return;
      }
    } catch (vectorSearchError: any) {
      console.warn(
        "MongoDB Atlas $vectorSearch not available or index not found. Falling back to local cosine scoring.",
        vectorSearchError.message
      );

      // Fallback: Retrieve saved pages and compute cosine similarity locally
      const allPages = await prisma.savedPage.findMany({
        where: { userId: DEFAULT_USER_ID },
        select: {
          id: true,
          userId: true,
          url: true,
          title: true,
          summary: true,
          intent: true,
          status: true,
          projectId: true,
          embedding: true,
          createdAt: true,
        },
      });

      const scored = allPages
        .map((page) => ({
          id: page.id,
          userId: page.userId,
          url: page.url,
          title: page.title,
          summary: page.summary,
          intent: page.intent,
          status: page.status,
          projectId: page.projectId,
          createdAt: page.createdAt,
          score: cosineSimilarity(embedding, page.embedding),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      res.status(200).json({
        success: true,
        method: "in_memory_cosine_fallback",
        note: "Calculated via fallback cosine similarity (ensure 'vector_index' is built on Atlas for production)",
        count: scored.length,
        results: scored,
      });
      return;
    }
  } catch (error: any) {
    console.error("Error in searchPages:", error);
    res.status(500).json({
      error: "Failed to perform semantic search",
      details: error.message,
    });
  }
}
