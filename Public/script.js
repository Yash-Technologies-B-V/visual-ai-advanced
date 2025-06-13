document.addEventListener('DOMContentLoaded', () => {
  const promptForm = document.getElementById('prompt-form');
  const promptInput = document.getElementById('prompt-input');
  const modeSlider = document.getElementById('mode-slider');
  const promptSuggestions = document.getElementById('prompt-suggestions');
  const sampleImages = document.getElementById('sample-images');
  const moodEmojis = document.getElementById('mood-emojis');
  const responseOutput = document.getElementById('response-output');
  const errorMessageElement = document.getElementById('error-message'); // NEW: Get the error message element

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

  // Helper function to display messages and handle UI state
  function updateUIState(status, message = '') {
      responseOutput.textContent = ''; // Clear previous response content
      errorMessageElement.textContent = ''; // Clear previous error content
      errorMessageElement.style.display = 'none'; // Hide error by default

      if (status === 'thinking') {
          responseOutput.textContent = 'Thinking...';
          // Potentially show a spinner if you have a dedicated spinner element
      } else if (status === 'error') {
          responseOutput.textContent = ''; // Ensure thinking message is cleared
          errorMessageElement.textContent = message;
          errorMessageElement.style.display = 'block';
      } else if (status === 'success') {
          // Response will be handled by displayResponse or image display
          responseOutput.textContent = message; // Set response text directly for non-long responses
          errorMessageElement.style.display = 'none';
      }
  }


  modeSlider.addEventListener('input', () => {
    const mode = modes[modeSlider.value];
    updateSuggestions(mode);
    updateSampleImage(mode);
    updateMoodEmoji(mode);
  });

  promptInput.addEventListener('input', async () => {
    const query = promptInput.value;
    const mode = modes[modeSlider.value];
    // Only fetch suggestions if there's actual input
    if (query.trim().length > 0) {
      await updateSuggestions(mode, query);
    } else {
      promptSuggestions.innerHTML = ''; // Clear suggestions if input is empty
    }
  });

  promptForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = promptInput.value;
    const mode = modes[modeSlider.value];

    updateUIState('thinking'); // Show 'Thinking...' message

    if (mode === 'Visual') {
      try {
        const response = await fetch('/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });

        // Check for non-OK response before parsing JSON
        if (!response.ok) {
          const errorData = await response.json(); // Assuming server sends JSON error
          throw new Error(`Server error: ${errorData.error || response.statusText}`);
        }

        const { imageUrl } = await response.json();
        console.log('🖼️ Generated Image URL:', imageUrl);

        if (imageUrl) {
          responseOutput.innerHTML = `<img src="${imageUrl}" alt="Generated Image" style="max-width:100%; border-radius:8px;" />`;
          updateUIState('success'); // Clear error message and thinking state
        } else {
          updateUIState('error', 'No image URL received from DALL-E API.');
        }

      } catch (err) {
        console.error('❌ Image generation error:', err);
        updateUIState('error', `Image generation failed: ${err.message}`); // Display error message
      }
    } else {
      // Logic for other modes (Simple, Creative, Analytical)
      try {
        const response = await fetch('/api/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, mode })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Text API error: ${errorData.error || response.statusText}`);
        }

        const result = await response.json();
        displayResponse(result); // Pass the entire result object
        updateUIState('success'); // Clear error message and thinking state

      } catch (err) {
        console.error(`❌ Text generation error for mode ${mode}:`, err);
        updateUIState('error', `${err.message}`); // Display error message
      }
    }
  });

  async function updateSuggestions(mode, query = '') {
    promptSuggestions.innerHTML = '';
    errorMessageElement.textContent = ''; // Clear error message for suggestions
    errorMessageElement.style.display = 'none';

    if (query.trim().length === 0) return;

    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Suggestion API error: ${errorData.error || res.statusText}`);
      }

      const data = await res.json();
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
          promptForm.dispatchEvent(new Event('submit'));
        });

        container.appendChild(text);
        container.appendChild(button);
        promptSuggestions.appendChild(container);
      });
    } catch (err) {
      console.error('❌ Failed to fetch suggestions:', err);
      // Display error only if it's not a rate limit that will auto-resolve on next try
      if (!err.message.includes("429")) { // Avoid showing transient rate limit errors in UI
        errorMessageElement.textContent = `Error fetching suggestions: ${err.message}`;
        errorMessageElement.style.display = 'block';
      }
    }
  }

  function updateSampleImage(mode) {
    sampleImages.innerHTML = `
      <img src="${images[mode]}" alt="${mode} example"
               style="max-width:100%; border-radius:8px; display:block;"
               onerror="this.style.display='none';" />
    `;
  }

  function updateMoodEmoji(mode) {
    moodEmojis.innerHTML = emojis[mode];
  }

  function displayResponse(response) {
    // Assuming response.response contains the text from the AI
    if (response.response && response.response.length > 300) {
      responseOutput.innerHTML = response.response.substring(0, 300) + '... <a href="#" id="read-more">Read more</a>';
      document.getElementById('read-more').addEventListener('click', (e) => {
        e.preventDefault();
        responseOutput.innerHTML = response.response;
      });
    } else if (response.response) {
      responseOutput.innerHTML = response.response;
    } else {
        responseOutput.innerHTML = 'No response received.';
    }
  }

  // Initial calls when page loads
  updateSuggestions(modes[0]);
  updateSampleImage(modes[0]);
  updateMoodEmoji(modes[0]);
});
