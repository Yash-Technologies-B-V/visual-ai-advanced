document.addEventListener('DOMContentLoaded', () => {
    const promptForm = document.getElementById('prompt-form');
    const promptInput = document.getElementById('prompt-input');
    const modeSlider = document.getElementById('mode-slider');
    const promptSuggestions = document.getElementById('prompt-suggestions');
    const sampleImages = document.getElementById('sample-images');
    const moodEmojis = document.getElementById('mood-emojis');
    const responseOutput = document.getElementById('response-output');
    const errorMessageElement = document.getElementById('error-message');

    const modes = ['Simple', 'Creative', 'Analytical', 'Visual'];
    const images = {
        Simple: 'simple.png',
        Creative: 'creative.png',
        Analytical: 'analytical.png',
        Visual: 'visual.png'
    };
    const emojis = {
        Simple: '😊',
        Creative: '🎨',
        Analytical: '🧠',
        Visual: '🖼️'
    };

    // Helper function to manage UI state and display messages
    function updateUIState(status, message = '') {
        // Always clear both response and error areas first
        responseOutput.innerHTML = ''; // Use innerHTML to clear any img tags
        errorMessageElement.textContent = '';
        errorMessageElement.style.display = 'none';
        responseOutput.style.display = 'none'; // Hide response box while in thinking/error state

        if (status === 'thinking') {
            responseOutput.textContent = 'Thinking...';
            responseOutput.style.display = 'block'; // Show "Thinking..."
        } else if (status === 'error') {
            errorMessageElement.textContent = message;
            errorMessageElement.style.display = 'block';
            responseOutput.style.display = 'none'; // Ensure response box is hidden on error
        } else if (status === 'success') {
            // Content will be set by displayResponse or image generation logic directly
            // Ensure the response box is visible when content is about to be set
            responseOutput.style.display = 'block';
            errorMessageElement.style.display = 'none';
        }
    }


    modeSlider.addEventListener('input', () => {
        const mode = modes[modeSlider.value];
        updateSuggestions(mode);
        updateSampleImage(mode);
        updateMoodEmoji(mode);
        // Clear main response/error when mode changes
        updateUIState('idle'); // Or 'clear', a neutral state
    });

    promptInput.addEventListener('input', async () => {
        const query = promptInput.value;
        const mode = modes[modeSlider.value]; // Ensure mode is correctly obtained
        if (query.trim().length > 0) {
            await updateSuggestions(mode, query);
        } else {
            promptSuggestions.innerHTML = '';
        }
    });

    promptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prompt = promptInput.value.trim(); // Trim prompt input
        const mode = modes[modeSlider.value];

        if (!prompt) {
            updateUIState('error', 'Please enter a prompt.');
            return;
        }

        updateUIState('thinking'); // Set UI to 'Thinking...'

        if (mode === 'Visual') {
            try {
                const response = await fetch('/generate-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Server error (${response.status}): ${errorData.error || response.statusText}`);
                }

                const { imageUrl } = await response.json();
                console.log('🖼️ Generated Image URL:', imageUrl); // This log is already present from your screenshot

                if (imageUrl) {
                    // Correctly inject the image. Added onerror for better debugging of image loading itself.
                    responseOutput.innerHTML = `<img src="${imageUrl}" alt="Generated Image" style="max-width:100%; height:auto; border-radius:8px; display:block;" onerror="this.onerror=null;this.src=''; console.error('Failed to load generated image.'); this.alt='Image failed to load';" />`;
                    updateUIState('success'); // Indicate success after image is displayed
                } else {
                    updateUIState('error', 'No valid image URL received from DALL-E API.');
                }

            } catch (err) {
                console.error('❌ Image generation error:', err);
                updateUIState('error', `Image generation failed: ${err.message}`);
            }
        } else { // Text-based modes (Simple, Creative, Analytical)
            try {
                const response = await fetch('/api/prompt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt, mode })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Text API error (${response.status}): ${errorData.error || response.statusText}`);
                }

                const result = await response.json();
                displayResponse(result); // Display the actual text response
                updateUIState('success'); // Indicate success after response is displayed

            } catch (err) {
                console.error(`❌ Text generation error for mode ${mode}:`, err);
                updateUIState('error', `${err.message}`);
            }
        }
    });

    async function updateSuggestions(mode, query = '') {
        promptSuggestions.innerHTML = ''; // Clear existing suggestions
        // Don't clear main error message here unless it's specifically for suggestions
        // errorMessageElement.textContent = '';
        // errorMessageElement.style.display = 'none';

        if (query.trim().length === 0) return;

        try {
            const res = await fetch('/api/suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: query })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(`Suggestion API error (${res.status}): ${errorData.error || res.statusText}`);
            }

            const data = await res.json();
            // console.log("Suggestions Data:", data.suggestions); // Debugging suggestions JSON parsing
            (data.suggestions || []).forEach(suggestion => {
                const container = document.createElement('div');
                container.classList.add('suggestion-container');

                const text = document.createElement('span');
                text.textContent = suggestion;

                const button = document.createElement('button');
                button.textContent = 'Use this';
                button.classList.add('use-suggestion');
                button.addEventListener('click', () => {
                    promptInput.value = suggestion;
                    promptForm.dispatchEvent(new Event('submit')); // Automatically submit when suggestion is used
                });

                container.appendChild(text);
                container.appendChild(button);
                promptSuggestions.appendChild(container);
            });
        } catch (err) {
            console.error('❌ Failed to fetch suggestions:', err);
            // Only display suggestion specific errors, not general ones
            // Avoid showing 429 for suggestions directly to user, as it's a backend rate limit.
            // You might want a more subtle "Suggestions unavailable" message.
            if (!err.message.includes("429") && !err.message.includes("Too Many Requests")) {
                errorMessageElement.textContent = `Error fetching suggestions: ${err.message}`;
                errorMessageElement.style.display = 'block';
            }
        }
    }

    function updateSampleImage(mode) {
        sampleImages.innerHTML = `
            <img src="${images[mode]}" alt="${mode} example"
                         style="max-width:100%; border-radius:8px; display:block;"
                         onerror="this.onerror=null;this.src=''; console.error('Failed to load sample image: ${images[mode]}'); this.alt='Image failed to load';" />
        `;
    }

    function updateMoodEmoji(mode) {
        moodEmojis.innerHTML = emojis[mode];
    }

    function displayResponse(response) {
        if (response.response) {
            // Handle markdown-like formatting if necessary, or just display raw text
            const fullText = response.response;
            if (fullText.length > 300) {
                responseOutput.innerHTML = fullText.substring(0, 300) + '... <a href="#" id="read-more" style="color:#007BFF; text-decoration:underline;">Read more</a>';
                document.getElementById('read-more').addEventListener('click', (e) => {
                    e.preventDefault();
                    responseOutput.innerHTML = fullText; // Show full response
                });
            } else {
                responseOutput.innerHTML = fullText;
            }
        } else {
            responseOutput.innerHTML = 'No response received.';
        }
        responseOutput.style.display = 'block'; // Ensure visibility after content is set
    }


    // Initial UI setup
    updateSuggestions(modes[0]); // Load initial suggestions for Simple mode
    updateSampleImage(modes[0]); // Load initial sample image for Simple mode
    updateMoodEmoji(modes[0]); // Load initial emoji for Simple mode
    updateUIState('idle'); // Set initial state to clear/idle
});
