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

  // Helper function to display messages and handle UI state
  function updateUIState(status, message = '') {
      responseOutput.textContent = ''; // Always clear response content initially
      errorMessageElement.textContent = ''; // Always clear error content initially
      errorMessageElement.style.display = 'none'; // Hide error by default

      if (status === 'thinking') {
          responseOutput.textContent = 'Thinking...';
      } else if (status === 'error') {
          errorMessageElement.textContent = message;
          errorMessageElement.style.display = 'block';
      } else if (status === 'success') {
          // IMPORTANT FIX: Removed `responseOutput.textContent = message;` from here.
          // The actual response content will be set by displayResponse or the image logic directly.
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
    if (query.trim().length > 0) {
      await updateSuggestions(mode, query);
    } else {
      promptSuggestions.innerHTML = '';
    }
  });

  promptForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = promptInput.value;
    const mode = modes[modeSlider.value];

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
          throw new Error(`Server error: ${errorData.error || response.statusText}`);
        }

        const { imageUrl } = await response.json();
        console.log('🖼️ Generated Image URL:', imageUrl);

        if (imageUrl) {
          responseOutput.innerHTML = `<img src="${imageUrl}" alt="Generated Image" style="max-width:100%; border-radius:8px;" />`;
          updateUIState('success'); // Indicate success after image is displayed
        } else {
          updateUIState('error', 'No image URL received from DALL-E API.');
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
          throw new Error(`Text API error: ${errorData.error || response.statusText}`);
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
          promptForm.dispatchEvent(new Event('submit')); // Automatically submit when suggestion is used
        });

        container.appendChild(text);
        container.appendChild(button);
        promptSuggestions.appendChild(container);
      });
    } catch (err) {
      console.error('❌ Failed to fetch suggestions:', err);
      // Only display suggestion specific errors, not general ones
      if (!err.message.includes("429")) { // Avoid showing 429 for suggestions too, as it's handled globally
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
    if (response.response && response.response.length > 300) {
      responseOutput.innerHTML = response.response.substring(0, 300) + '... <a href="#" id="read-more">Read more</a>';
      document.getElementById('read-more').addEventListener('click', (e) => {
        e.preventDefault();
        responseOutput.innerHTML = response.response; // Show full response
      });
    } else if (response.response) {
      responseOutput.innerHTML = response.response;
    } else {
        responseOutput.innerHTML = 'No response received.';
    }
  }

  // Initial UI setup
  updateSuggestions(modes[0]);
  updateSampleImage(modes[0]);
  updateMoodEmoji(modes[0]);
});
