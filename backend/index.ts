import express from "express";
import { tavily } from '@tavily/core';

const app = express();

app.use(express.json());

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

    //step 6 - hit the llm and stream back the response 

    //also stream the sources and the follow up questions. 
})

app.listen(3000);
