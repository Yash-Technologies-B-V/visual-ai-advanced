const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

// Function to generate AI response using Azure OpenAI (GPT)
async function generateAIResponse(prompt) {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
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

    const response = await axios.post(url, body, { headers });
    return response.data.choices[0].message.content;
}

// Function to generate image using Azure OpenAI DALL·E
async function generateImage(prompt) {
    const endpoint = process.env.DALLE_OPENAI_ENDPOINT;
    const apiKey = process.env.DALLE_OPENAI_API_KEY;
    const apiVersion = process.env.DALLE_OPENAI_API_VERSION;

    const url = `${endpoint}/openai/images/generations:submit?api-version=${apiVersion}`;

    const headers = {
        'Content-Type': 'application/json',
        'api-key': apiKey
    };

    const body = {
        prompt: prompt,
        n: 1,
        size: "1024x1024"
    };

    const response = await axios.post(url, body, { headers });
    return response.headers['operation-location'];
}

// API endpoint to handle GPT prompts
app.post('/api/prompt', async (req, res) => {
    const prompt = req.body.prompt;
    const sessionData = req.session;

    try {
        const response = await generateAIResponse(prompt);

        if (!sessionData.history) {
            sessionData.history = [];
        }
        sessionData.history.push({ prompt, response });

        const tokenUsage = Math.floor(Math.random() * 10) + 1;

        res.json({ response, tokenUsage, history: sessionData.history });
    } catch (error) {
        console.error('Error generating AI response:', error.message);
        res.status(500).json({ error: 'Failed to generate AI response' });
    }
});

// API endpoint to handle DALL·E image generation
app.post('/generate-image', async (req, res) => {
    const { prompt } = req.body;

    try {
        const operationLocation = await generateImage(prompt);
        res.json({ operationLocation });
    } catch (error) {
        console.error('Error generating image:', error.message);
        res.status(500).send('Image generation failed');
    }
});

// Serve static files
app.use(express.static('public'));

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
