const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' folder

// Environment variables for DALL-E API
const DALLE_OPENAI_ENDPOINT = process.env.DALLE_OPENAI_ENDPOINT;
const DALLE_OPENAI_API_KEY = process.env.DALLE_OPENAI_API_KEY;
const DALLE_OPENAI_API_VERSION = process.env.DALLE_OPENAI_API_VERSION;
const DALLE_DEPLOYMENT_NAME = process.env.DALLE_DEPLOYMENT_NAME;

// --- DALL-E Image Generation Function ---
async function generateImage(prompt) {
    if (!DALLE_OPENAI_ENDPOINT || !DALLE_OPENAI_API_KEY || !DALLE_OPENAI_API_VERSION || !DALLE_DEPLOYMENT_NAME) {
        throw new Error("DALL-E API environment variables are not set.");
    }

    const endpoint = DALLE_OPENAI_ENDPOINT;
    const apiVersion = DALLE_OPENAI_API_VERSION;
    const deploymentName = DALLE_DEPLOYMENT_NAME;

    // Construct the URL exactly as provided by the Azure Portal's Target URI
    const url = `${endpoint}openai/deployments/${deploymentName}/images/generations?api-version=${apiVersion}`;

    const headers = {
        'api-key': DALLE_OPENAI_API_KEY,
        'Content-Type': 'application/json',
    };

    const data = {
        prompt: prompt,
        n: 1, // Number of images to generate (DALL-E 3 supports 1)
        size: "1024x1024", // Supported sizes: 1024x1024, 1792x1024, 1024x1792
        // response_format: "url", // DALL-E 3 typically returns URLs by default
    };

    try {
        console.log(`Attempting to call DALL-E API at: ${url}`);
        const response = await axios.post(url, data, { headers });

        console.log(`🔍 DALL-E API response status: ${response.status}`);
        console.log(`🔍 DALL-E API response data: ${JSON.stringify(response.data, null, 2)}`);
        // console.log(`🔍 Full DALL-E Response Headers: ${JSON.stringify(response.headers, null, 2)}`);

        // For synchronous DALL-E calls, the image URL(s) are directly in the response.data.data
        if (response.data && response.data.data && response.data.data.length > 0) {
            return response.data.data[0].url; // Assuming one image is requested (n:1)
        } else {
            throw new Error("No image URL found in DALL-E API response.");
        }

    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(`❌ Error calling DALL-E image generation API: Request failed with status code ${error.response.status}`);
            console.error(`🔍 DALL-E API response status: ${error.response.status}`);
            console.error(`🔍 DALL-E API response data: ${JSON.stringify(error.response.data, null, 2)}`);
            // console.error(`🔍 Full DALL-E Response Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
            throw new Error(`DALL-E API error (Status: ${error.response.status}): ${JSON.stringify(error.response.data.error || error.response.data)}`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error(`❌ Error calling DALL-E image generation API: No response received from server.`);
            console.error(error.request);
            throw new Error("No response received from DALL-E API.");
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('❌ Error in DALL-E image generation API request setup:', error.message);
            throw new Error(`Error setting up DALL-E API request: ${error.message}`);
        }
    }
}

// --- API Routes ---

// Route to serve the main HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to handle image generation requests
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


// --- Start the server ---
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
