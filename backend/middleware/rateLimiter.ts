import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import "../express.d.ts";

export async function rateLimiter(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || "5", 10);
        const windowHours = parseInt(process.env.RATE_LIMIT_WINDOW_HOURS || "1", 10);
        const windowMs = windowHours * 60 * 60 * 1000;
        const cutoff = new Date(Date.now() - windowMs);

        console.log(`[RateLimiter] Checking user=${userId} since=${cutoff.toISOString()} limit=${maxRequests}`);

        const userQueries = await prisma.message.findMany({
            where: {
                role: "USER",
                createdAt: { gte: cutoff },
                conversation: {
                    userId: userId
                }
            },
            orderBy: {
                createdAt: "asc"
            }
        });

        // console.log(`[RateLimiter] Found ${userQueries.length} user queries.`);

        if (userQueries.length >= maxRequests) {
            const oldestQuery = userQueries[0];
            if (oldestQuery) {
                const resetTime = new Date(oldestQuery.createdAt.getTime() + windowMs);
                const timeStr = resetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return res.status(429).json({
                    error: `Rate limit exceeded. You can only ask ${maxRequests} questions every ${windowHours} hour. Try again after ${timeStr}.`
                });
            }
        }

        next();
    } catch (e) {
        console.error("Rate limiter error:", e);
        next();
    }
}
