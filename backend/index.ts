import express from "express";
import { tavily } from '@tavily/core';
import OpenAI from "openai"
import { PROMPT_TEMPLATE, SYSTEM_PROMPT, NO_SEARCH_PROMPT_TEMPLATE, WEB_SEARCH_DECISION_PROMPT } from "./prompt";
import { prisma } from "./db";
import { authMiddleware } from "./middleware/authMiddleware";
import { rateLimiter } from "./middleware/rateLimiter";
import cors from "cors";
import "./express.d.ts";

const app = express();

app.use(express.json());
app.use(cors());

app.get("/conversations", authMiddleware, async ( req, res ) => {
    try {
        const conversations = await prisma.conversation.findMany({
            where: {
                userId: req.userId
            },
            include: {
                messages: {
                    orderBy: {
                        createdAt: "asc"
                    },
                    take: 1
                }
            }
        });
        res.json({ conversations });
    } catch (e) {
        console.error("Error fetching conversations:", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/conversations/:id", authMiddleware, async (req, res) => {
    try {
        const conversation = await prisma.conversation.findUnique({
            where: {
                id: req.params.id as string
            },
            include: {
                messages: {
                    orderBy: {
                        createdAt: "asc"
                    }
                }
            }
        });

        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        if (conversation.userId !== req.userId) {
            return res.status(403).json({ error: "Forbidden" });
        }

        res.json({ conversation });
    } catch (e) {
        console.error("Error fetching conversation:", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/conversation", authMiddleware, rateLimiter, async (req, res) => {
    const query = req.body.query;

    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    const slug = query.split(" ").slice(0, 5).join("-").toLowerCase().replace(/[^a-z0-9-]/g, "");
    let conversation;
    try {
        conversation = await prisma.conversation.create({
            data: {
                userId: req.userId!,
                slug: slug || "new-conversation",
            }
        });

        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                role: "USER",
                content: query
            }
        });
    } catch (dbError) {
        console.error("Error saving initial conversation to database:", dbError);
        return res.status(500).json({ error: "Internal Server Error" });
    }

    const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const webSearchResponse = await tavilyClient.search(query, {
        includeAnswer: "basic",
        searchDepth: "advanced"
    });

    const webSearchResult = webSearchResponse.results;   

    const prompt = PROMPT_TEMPLATE.replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResult)).replace("{{USER_QUERY}}", query)

    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.AI_GATEWAY_API_KEY
    })

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullAnswer = "";

    try {
        const response = await openai.chat.completions.create({
            model: "auto",
            messages: [
                {role:"system", content: SYSTEM_PROMPT},
                {role: "user", content: prompt}
            ],
            stream: true
        })

        for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                fullAnswer += content;
                res.write(content);
            }
        }
    } catch (e) {
        console.error("OpenAI stream error:", e);
        res.write(`Error during streaming: ${(e as Error).message}\n`);
    }

    res.write("\n<SOURCES>\n")
    const sources = webSearchResult.map(result => ({ url: result.url }));
    res.write(JSON.stringify(sources));
    res.write("\n</SOURCES>\n")

    res.end();

    try {
        await prisma.message.create({
            data: {
                conversationId: conversation.id,
                role: "ASSISTANT",
                content: JSON.stringify({
                    answer: fullAnswer,
                    sources: sources
                })
            }
        });
    } catch (dbError) {
        console.error("Error saving conversation to database:", dbError);
    }
});

app.post("/conversation/follow_up", authMiddleware, rateLimiter, async ( req, res) => {
    const { conversationId, query } = req.body;

    if (!conversationId || !query) {
        return res.status(400).json({ error: "conversationId and query are required" });
    }

    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                messages: {
                    orderBy: {
                        createdAt: "asc"
                    }
                }
            }
        });

        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        if (conversation.userId !== req.userId) {
            return res.status(403).json({ error: "Forbidden" });
        }

        // Save user message in db first to ensure it registers in the rate limiter window immediately
        try {
            await prisma.message.create({
                data: {
                    conversationId: conversationId,
                    role: "USER",
                    content: query
                }
            });
        } catch (dbError) {
            console.error("Error saving follow up USER query to database:", dbError);
            return res.status(500).json({ error: "Internal Server Error" });
        }

        const openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: process.env.AI_GATEWAY_API_KEY
        });

        // Build a compact conversation history summary to feed into the routing decision
        const conversationHistorySummary = conversation.messages.map(msg => {
            if (msg.role === "USER") {
                return `User: ${msg.content}`;
            } else {
                try {
                    const parsed = JSON.parse(msg.content);
                    return `Assistant: ${parsed.answer || msg.content}`;
                } catch {
                    return `Assistant: ${msg.content}`;
                }
            }
        }).join("\n");

        // Ask the agent (LLM) whether a web search is needed for this follow-up
        const decisionPrompt = WEB_SEARCH_DECISION_PROMPT
            .replace("{{CONVERSATION_HISTORY}}", conversationHistorySummary)
            .replace("{{USER_QUERY}}", query);

        const decisionResponse = await openai.chat.completions.create({
            model: "auto",
            messages: [{ role: "user", content: decisionPrompt }],
            max_tokens: 10     // TO restrict the model to only output SEARCH or NO_SEARCH
        });

        const decisionText = (decisionResponse.choices[0]?.message?.content ?? "").trim().toUpperCase();
        const needsWebSearch = decisionText.startsWith("SEARCH");

        // console.log(`[follow_up] Web search decision for query "${query}": ${needsWebSearch ? "SEARCH" : "NO_SEARCH"}`);

        // Build the messages array from conversation history for the final LLM call
        const messagesForLLM: { role: "system" | "user" | "assistant"; content: string }[] = [
            { role: "system", content: SYSTEM_PROMPT }
        ];

        for (const msg of conversation.messages) {
            if (msg.role === "USER") {
                messagesForLLM.push({ role: "user", content: msg.content });
            } else {
                try {
                    const parsed = JSON.parse(msg.content);
                    messagesForLLM.push({ role: "assistant", content: parsed.answer || msg.content });
                } catch {
                    messagesForLLM.push({ role: "assistant", content: msg.content });
                }
            }
        }

        let sources: { url: string }[] = [];

        if (needsWebSearch) {
            // Perform web search and include results in the prompt
            const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });
            const webSearchResponse = await tavilyClient.search(query, {
                includeAnswer: "basic",
                searchDepth: "advanced"
            });
            const webSearchResult = webSearchResponse.results;
            sources = webSearchResult.map(result => ({ url: result.url }));

            const nextPrompt = PROMPT_TEMPLATE
                .replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResult))
                .replace("{{USER_QUERY}}", query);
            messagesForLLM.push({ role: "user", content: nextPrompt });
        } else {
            // No web search — answer from conversation history and general knowledge
            const nextPrompt = NO_SEARCH_PROMPT_TEMPLATE
                .replace("{{USER_QUERY}}", query);
            messagesForLLM.push({ role: "user", content: nextPrompt });
        }

        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        let fullAnswer = "";

        const response = await openai.chat.completions.create({
            model: "auto",
            messages: messagesForLLM,
            stream: true
        });

        for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                fullAnswer += content;
                res.write(content);
            }
        }

        res.write("\n<SOURCES>\n");
        res.write(JSON.stringify(sources));
        res.write("\n</SOURCES>\n");

        res.end();

        await prisma.message.create({
            data: {
                conversationId: conversationId,
                role: "ASSISTANT",
                content: JSON.stringify({
                    answer: fullAnswer,
                    sources: sources
                })
            }
        });
    } catch (e) {
        console.error("Error during follow up:", e);
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal Server Error" });
        } else {
            res.write(`\nError during follow up processing: ${(e as Error).message}\n`);
            res.end();
        }
    }
});

app.delete("/conversations/:id", authMiddleware, async (req, res) => {
    try {
        const id = req.params.id as string;
        const conversation = await prisma.conversation.findUnique({
            where: { id }
        });

        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        if (conversation.userId !== req.userId) {
            return res.status(403).json({ error: "Forbidden" });
        }

        // Delete associated messages first
        await prisma.message.deleteMany({
            where: { conversationId: id }
        });

        // Delete the conversation
        await prisma.conversation.delete({
            where: { id }
        });

        res.json({ success: true });
    } catch (e) {
        console.error("Error deleting conversation:", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.put("/conversations/:id", authMiddleware, async (req, res) => {
    try {
        const id = req.params.id as string;
        const { slug } = req.body;

        if (!slug) {
            return res.status(400).json({ error: "Slug is required" });
        }

        const conversation = await prisma.conversation.findUnique({
            where: { id }
        });

        if (!conversation) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        if (conversation.userId !== req.userId) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const updated = await prisma.conversation.update({
            where: { id },
            data: { slug }
        });

        res.json({ success: true, conversation: updated });
    } catch (e) {
        console.error("Error updating conversation:", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(3001);

