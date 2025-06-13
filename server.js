const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const axios = require('axios');
const path = require('path'); // Added for path resolution
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret-key', // Use a strong, unique secret in production
    resave: false,
    saveUninitialized: true
}));

// Serve static files from the 'public' directory
// IMPORTANT: Ensure your index.html, script.js, style.css, and images (simple.png, creative.png, etc.)
// are all located inside a folder named 'public' relative to your server.js file.
app.use(express.static(path.join(__dirname, 'public')));


// --- Helper Functions for API Calls ---

// GPT response (for prompt suggestions and AI chat)
async function generateAIResponse(prompt) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT; // This is correct for chat models
    const apiKey = process.env.AZURE_OPENAI_KEY;

    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;

    const headers = {
        'Content-Type': 'application/json',
        'api-key': apiKey
    };

    const body = {
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
    };

    try {
        const response = await axios.post(url, body, { headers });
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('❌ Error in generateAIResponse (GPT):', error.message);
        if (error.response) {
            console.error('🔍 GPT API response status:', error.response.status);
            console.error('🔍 GPT API response data:', JSON.stringify(error.response.data, null, 2));
        }
        throw error; // Re-throw to be caught by the route handler
    }
}

// DALL·E image generation
async function generateImage(prompt) {
    const endpoint = process.env.DALLE_OPENAI_ENDPOINT;
    const apiKey = process.env.DALLE_OPENAI_API_KEY;
    const apiVersion = process.env.DALLE_OPENAI_API_VERSION; // e.g., "2023-06-01-preview"

    // CORRECT DALL-E 3 URL for Azure OpenAI.
    // It does NOT include '/deployments/{deployment_name}'
    // and requires ':submit' for asynchronous operation.
    const url = `${endpoint}/openai/images/generations:submit?api-version=${apiVersion}`;

    const headers = {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'Accept': 'application/json'
    };
    const body = {
        prompt: prompt,
        n: 1, // Number of images to generate (usually 1 for DALL-E 3)
        size: "1024x1024" // Image size
        // You might add 'quality' and 'style' here if needed, e.g., quality: "hd", style: "vivid"
    };

    try {
        const response = await axios.post(url, body, { headers });

        console.log('🔍 Full DALL-E Response Headers:', JSON.stringify(response.headers, null, 2));

        // Axios normalizes header names to lowercase
        const operationLocation = response.headers['operation-location'];

        if (!operationLocation) {
            console.error("❌ DALL-E API: Operation-Location header not found in response!");
            // Log the response body if it's not OK, to understand why header is missing
            if (!response.status || response.status >= 400) {
                 console.error('🔍 DALL-E API Bad Response Data:', JSON.stringify(response.data, null, 2));
            }
            throw new Error("DALL-E API did not return an Operation-Location header.");
        }

        console.log('🚀 DALL-E Operation Location:', operationLocation);
        return operationLocation;

    } catch (error) {
        console.error('❌ Error calling DALL-E image generation API:', error.message);
        if (error.response) {
            console.error('🔍 DALL-E API response status:', error.response.status);
            console.error('🔍 DALL-E API response data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('🔍 DALL-E API no response received:', error.request);
        } else {
            console.error('🔍 DALL-E API request setup error:', error.message);
        }
        throw error; // Re-throw to be caught by the /generate-image route handler
    }
}


// --- API Routes ---

// Polling endpoint for DALL-E image status
app.get('/image-status', async (req, res) => {
    const { url } = req.query; // This 'url' should now be the valid operationLocation from DALL-E

    if (!url) {
        console.error('❌ /image-status: Missing operation URL in query parameter.');
        return res.status(400).json({ error: 'Missing operation URL' });
    }

    try {
        const headers = {
            'api-key': process.env.DALLE_OPENAI_API_KEY
        };
        const response = await axios.get(url, { headers });
        console.log('📡 Polling Response Data:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('❌ Error polling image status:', error.message);
        if (error.response) {
            console.error('🔍 Polling API response status:', error.response.status);
            console.error('🔍 Polling API response data:', JSON.stringify(error.response.data, null, 2));
        }
        res.status(500).json({ error: 'Failed to poll image status' });
    }
});

// Prompt suggestions endpoint (uses GPT model)
app.post('/api/suggestions', async (req, res) => {
    const { prompt } = req.body;

    try {
        const suggestionsText = await generateAIResponse(
            `Rewrite the following question into 3-5 clearer prompt suggestions for DALL-E:\n\n"${prompt}"`
        );

        const suggestions = suggestionsText
            .split('\n')
            .map(s => s.replace(/^[0-9\-\*\.\s]+/, '').trim())
            .filter(s => s.length > 0);

        res.json({ suggestions });
    } catch (error) {
        console.error('❌ Error in /api/suggestions:', error.message);
        res.status(500).json({ error: 'Failed to generate suggestions' });
    }
});

// Main AI prompt handler (uses GPT model)
app.post('/api/prompt', async (req, res) => {
    const prompt = req.body.prompt;
    const sessionData = req.session;

    try {
        const response = await generateAIResponse(prompt);

        if (!sessionData.history) {
            sessionData.history = [];
        }
        sessionData.history.push({ prompt, response });

        // Placeholder for token usage - you'd calculate this from the API response if available
        const tokenUsage = Math.floor(Math.random() * 10) + 1;

        res.json({ response, tokenUsage, history: sessionData.history });
    } catch (error) {
        console.error('❌ Error in /api/prompt:', error.message);
        res.status(500).json({ error: 'Failed to generate AI response' });
    }
});

// Image generation handler
app.post('/generate-image', async (req, res) => {
    const { prompt } = req.body;

    try {
        const operationLocation = await generateImage(prompt);
        // Send the operationLocation back to the frontend for polling
        res.json({ operationLocation });
    } catch (error) {
        // The generateImage function already logs detailed error info.
        // We just send a generic error to the client.
        res.status(500).json({ error: 'Image generation failed' });
    }
});


// --- Server Start ---
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
