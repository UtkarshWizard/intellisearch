import express from "express";
import { tavily } from '@tavily/core';
import OpenAI from "openai"
import { PROMPT_TEMPLATE, SYSTEM_PROMPT } from "./prompt";
import { prisma } from "./db";

const app = express();

app.use(express.json());

app.post("/signUp", async ( req , res) => {

});

app.post("/signIn", async ( req , res) => {

});

app.get("/conversations", async ( req, res ) => {
    // get all the conversations for the user
    
});

app.get("/conversations/:id", async (req, res) => {
    // get a single conversation
});

app.post("/conversation", async (req, res) => {
    //Step1 - get the user query
    const query = req.body.query;

    //step 2 - make sure user has access/credits to hit the component 

    //step 3 - check if we have web search indexed for a similar query 

    //step 4 - web search to gather sources 
    const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const webSearchResponse = await tavilyClient.search(query, {
        includeAnswer: "basic",
        searchDepth: "advanced"
    });

    const webSearchResult = webSearchResponse.results;   

    //step 5 - do some context engineering on the prompt + web serch response
    const prompt = PROMPT_TEMPLATE.replace("{{WEB_SEARCH_RESULTS}}", JSON.stringify(webSearchResult)).replace("{{USER_QUERY}}", query)

    // step 6 - hit the llm and stream back the response 
    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.AI_GATEWAY_API_KEY
    })

    res.setHeader("Content-Type", "text/palin");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

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
                res.write(content);
            }
        }
    } catch (e) {
        console.error("OpenAI stream error:", e);
        res.write(`Error during streaming: ${(e as Error).message}\n`);
    }

    res.write("\n<SOURCES>\n")
    
    webSearchResult.forEach(result => res.write(JSON.stringify({url: result.url})));
    
    res.write("\n</SOURCES>\n")

    res.end();

    //also stream the sources and the follow up questions. 
});

app.post("/conversation/follow_up", async ( req, res) => {
    // step 1: get the existing chat from db;
    // step 2: use the history to do a new web search;   
    // step 2.5 do some context engineering here.
    // step 3: Stream the response to the user again from the llm.
})

app.listen(3000);
