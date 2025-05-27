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
app.use(express.static('public'));

// GPT response
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

// DALL·E image generation
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

// Polling endpoint for image generation status
app.get('/image-status', async (req, res) => {
    const { url } = req.query;
    try {
        const headers = {
            'api-key': process.env.DALLE_OPENAI_API_KEY
        };
        const response = await axios.get(url, { headers });
        res.json(response.data);
    } catch (error) {
        console.error('Error polling image status:', error.message);
        res.status(500).json({ error: 'Failed to poll image status' });
    }
});

// GPT prompt suggestions
app.post('/api/suggestions', async (req, res) => {
    const { prompt } = req.body;

    try {
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
        const apiKey = process.env.AZURE_OPENAI_KEY;

        const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-15-preview`;

        const headers = {
            'Content-Type': 'application/json',
            'api-key': apiKey
        };

        const body = {
            messages: [
                { role: 'system', content: 'You are a helpful assistant that rewrites user questions into clearer, more specific prompts.' },
                { role: 'user', content: `Rewrite the following question into 3-5 clearer prompt suggestions:\n\n"${prompt}"` }
            ],
            temperature: 0.7
        };

        const response = await axios.post(url, body, { headers });
        const suggestionsText = response.data.choices[0].message.content;

        const suggestions = suggestionsText
            .split('\n')
            .map(s => s.replace(/^[0-9\-\*\.\s]+/, '').trim())
            .filter(s => s.length > 0);

        res.json({ suggestions });
    } catch (error) {
        console.error('Error generating suggestions:', error.message);
        res.status(500).json({ error: 'Failed to generate suggestions' });
    }
});

// GPT prompt handler
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

// DALL·E image handler
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

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
