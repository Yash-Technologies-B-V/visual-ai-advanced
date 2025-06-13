const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' folder

// Environment variables for DALL-E API (already existing)
const DALLE_OPENAI_ENDPOINT = process.env.DALLE_OPENAI_ENDPOINT;
const DALLE_OPENAI_API_KEY = process.env.DALLE_OPENAI_API_KEY;
const DALLE_OPENAI_API_VERSION = process.env.DALLE_OPENAI_API_VERSION; // Still used for DALL-E
const DALLE_DEPLOYMENT_NAME = process.env.DALLE_DEPLOYMENT_NAME;

// --- NEW Environment variables for TEXT API ---
const TEXT_OPENAI_DEPLOYMENT_NAME = process.env.TEXT_OPENAI_DEPLOYMENT_NAME; // e.g., 'gpt-35-turbo'
const TEXT_OPENAI_API_VERSION = process.env.TEXT_OPENAI_API_VERSION || "2024-02-01"; // Or whatever version you use for text models

// --- DALL-E Image Generation Function (already existing) ---
async function generateImage(prompt) {
    if (!DALLE_OPENAI_ENDPOINT || !DALLE_OPENAI_API_KEY || !DALLE_OPENAI_API_VERSION || !DALLE_DEPLOYMENT_NAME) {
        throw new Error("DALL-E API environment variables are not set.");
    }

    const endpoint = DALLE_OPENAI_ENDPOINT;
    const apiVersion = DALLE_OPENAI_API_VERSION;
    const deploymentName = DALLE_DEPLOYMENT_NAME;

    const url = `${endpoint}openai/deployments/${deploymentName}/images/generations?api-version=${apiVersion}`;

    const headers = {
        'api-key': DALLE_OPENAI_API_KEY,
        'Content-Type': 'application/json',
    };

    const data = {
        prompt: prompt,
        n: 1,
        size: "1024x1024",
    };

    try {
        console.log(`Attempting to call DALL-E API at: ${url}`);
        const response = await axios.post(url, data, { headers });

        console.log(`🔍 DALL-E API response status: ${response.status}`);
        console.log(`🔍 DALL-E API response data: ${JSON.stringify(response.data, null, 2)}`);

        if (response.data && response.data.data && response.data.data.length > 0) {
            return response.data.data[0].url;
        } else {
            throw new Error("No image URL found in DALL-E API response.");
        }

    } catch (error) {
        if (error.response) {
            console.error(`❌ Error calling DALL-E image generation API: Request failed with status code ${error.response.status}`);
            console.error(`🔍 DALL-E API response data: ${JSON.stringify(error.response.data.error || error.response.data)}`);
            throw new Error(`DALL-E API error (Status: ${error.response.status}): ${JSON.stringify(error.response.data.error || error.response.data)}`);
        } else if (error.request) {
            console.error(`❌ Error calling DALL-E image generation API: No response received from server.`);
            throw new Error("No response received from DALL-E API.");
        } else {
            console.error('❌ Error in DALL-E image generation API request setup:', error.message);
            throw new Error(`Error setting up DALL-E API request: ${error.message}`);
        }
    }
}

// --- NEW: Text Model Interaction Function ---
async function getChatCompletion(prompt, systemMessageContent = "You are a helpful AI assistant.") {
    if (!DALLE_OPENAI_ENDPOINT || !DALLE_OPENAI_API_KEY || !TEXT_OPENAI_DEPLOYMENT_NAME || !TEXT_OPENAI_API_VERSION) {
        throw new Error("Text API environment variables are not set. Ensure DALLE_OPENAI_ENDPOINT, DALLE_OPENAI_API_KEY, TEXT_OPENAI_DEPLOYMENT_NAME, and TEXT_OPENAI_API_VERSION are configured.");
    }

    const endpoint = DALLE_OPENAI_ENDPOINT; // Same endpoint as DALL-E
    const apiVersion = TEXT_OPENAI_API_VERSION;
    const deploymentName = TEXT_OPENAI_DEPLOYMENT_NAME;

    const url = `${endpoint}openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

    const headers = {
        'api-key': DALLE_OPENAI_API_KEY, // Same API Key as DALL-E
        'Content-Type': 'application/json',
    };

    const messages = [
        { role: "system", content: systemMessageContent },
        { role: "user", content: prompt }
    ];

    try {
        console.log(`Attempting to call Text API at: ${url}`);
        const response = await axios.post(url, { messages }, { headers });
        console.log(`🔍 Text API response status: ${response.status}`);
        // console.log(`🔍 Text API response data: ${JSON.stringify(response.data, null, 2)}`);

        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return response.data.choices[0].message.content;
        } else {
            throw new Error("No text response found in API completion.");
        }
    } catch (error) {
        if (error.response) {
            console.error(`❌ Error calling Text completion API: Request failed with status code ${error.response.status}`);
            console.error(`🔍 Text API response data: ${JSON.stringify(error.response.data.error || error.response.data)}`);
            throw new Error(`Text API error (Status: ${error.response.status}): ${JSON.stringify(error.response.data.error || error.response.data)}`);
        } else if (error.request) {
            console.error(`❌ Error calling Text completion API: No response received from server.`);
            throw new Error("No response received from Text API.");
        } else {
            console.error('❌ Error in Text completion API request setup:', error.message);
            throw new Error(`Error setting up Text API request: ${error.message}`);
        }
    }
}


// --- API Routes ---

// Route to serve the main HTML page (already existing)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to handle image generation requests (already existing)
app.post('/generate-image', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
    }

    try {
        const imageUrl = await generateImage(prompt);
        res.json({ imageUrl: imageUrl });
    } catch (error) {
        console.error('Error in /generate-image route:', error.message);
        res.status(500).json({ error: error.message });
    }
});


// --- NEW: Route for main prompt processing (Simple, Creative, Analytical modes) ---
app.post('/api/prompt', async (req, res) => {
    const { prompt, mode } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
    }

    let systemMessage = "You are a helpful AI assistant."; // Default system message

    // Adjust system message or prompt based on mode
    switch (mode) {
        case 'Simple':
            systemMessage = "You are a concise and straightforward AI assistant. Provide direct answers without excessive detail.";
            break;
        case 'Creative':
            systemMessage = "You are a highly imaginative and creative AI assistant. Respond with innovative ideas, stories, or expressive descriptions.";
            break;
        case 'Analytical':
            systemMessage = "You are a highly analytical and logical AI assistant. Break down complex problems, offer structured explanations, and focus on factual accuracy.";
            break;
        // Visual mode handled by /generate-image
    }

    try {
        const responseText = await getChatCompletion(prompt, systemMessage);
        res.json({ response: responseText });
    } catch (error) {
        console.error(`Error in /api/prompt route for mode ${mode}:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- NEW: Route for prompt suggestions ---
app.post('/api/suggestions', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
    }

    const systemMessage = `You are an AI assistant specialized in generating concise, distinct prompt ideas or questions related to a given topic. Provide 3-5 suggestions, formatted as a JSON array of strings. Do not include any other text or explanation outside the JSON.
    Example:
    User: "Tell me about cars"
    Assistant: ["History of electric cars", "Future of autonomous vehicles", "Impact of cars on environment"]`;

    // The user's input "prompt" is the base for generating suggestions
    const suggestionPrompt = `Generate 3-5 distinct prompt ideas or questions related to: "${prompt}"`;

    try {
        const rawSuggestions = await getChatCompletion(suggestionPrompt, systemMessage);
        console.log("Raw suggestions from AI:", rawSuggestions);

        let suggestions = [];
        try {
            // Attempt to parse the raw string as JSON
            suggestions = JSON.parse(rawSuggestions);
            // Ensure it's an array of strings, otherwise default to empty array
            if (!Array.isArray(suggestions) || !suggestions.every(item => typeof item === 'string')) {
                suggestions = [];
            }
        } catch (parseError) {
            console.warn("Failed to parse AI suggestions as JSON array. Falling back to simple string split.", parseError);
            // Fallback: if parsing fails, try splitting by common delimiters
            suggestions = rawSuggestions.split('\n').filter(s => s.trim() !== '').map(s => s.replace(/^- /, '').trim());
            // Limit to a reasonable number
            if (suggestions.length > 5) suggestions = suggestions.slice(0, 5);
        }

        res.json({ suggestions: suggestions });
    } catch (error) {
        console.error('Error in /api/suggestions route:', error.message);
        res.status(500).json({ error: error.message });
    }
});


// --- Start the server ---
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
