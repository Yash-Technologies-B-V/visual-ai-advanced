document.addEventListener('DOMContentLoaded', () => {
  const promptForm = document.getElementById('prompt-form');
  const promptInput = document.getElementById('prompt-input');
  const modeSlider = document.getElementById('mode-slider');
  const promptSuggestions = document.getElementById('prompt-suggestions');
  const sampleImages = document.getElementById('sample-images');
  const moodEmojis = document.getElementById('mood-emojis');
  const responseOutput = document.getElementById('response-output');

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

  modeSlider.addEventListener('input', () => {
    const mode = modes[modeSlider.value];
    updateSuggestions(mode);
    updateSampleImage(mode);
    updateMoodEmoji(mode);
  });

  promptInput.addEventListener('input', async () => {
    const query = promptInput.value;
    const mode = modes[modeSlider.value];
    await updateSuggestions(mode, query);
  });

  promptForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = promptInput.value;
    const mode = modes[modeSlider.value];

    responseOutput.innerHTML = 'Thinking...';

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

        // --- MODIFIED SECTION FOR VISUAL MODE ---
        // Expecting { imageUrl: "..." } directly from the server.js /generate-image endpoint
        const { imageUrl } = await response.json();
        console.log('🖼️ Generated Image URL:', imageUrl);

        if (imageUrl) {
          responseOutput.innerHTML = `<img src="${imageUrl}" alt="Generated Image" style="max-width:100%; border-radius:8px;" />`;
        } else {
          responseOutput.innerHTML = 'No image URL received from DALL-E API.';
        }
        // --- END OF MODIFIED SECTION ---

      } catch (err) {
        console.error('❌ Image generation error:', err);
        responseOutput.innerHTML = `Image generation failed: ${err.message}`; // Display error message
      }
    } else {
      // Logic for other modes (Simple, Creative, Analytical) remains unchanged
      const response = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode })
      }).then(res => res.json());

      displayResponse(response);
    }
  });

  async function updateSuggestions(mode, query = '') {
    promptSuggestions.innerHTML = '';
    if (query.trim().length === 0) return;

    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query })
      });

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
    }
  }

  function updateSampleImage(mode) {
    sampleImages.innerHTML = `
      <img src="${images[mode]}" alt=""
             style="max-width:100%; border-radius:8px; display:block;"
             onerror="this.style.display='none';" />
    `;
  }

  function updateMoodEmoji(mode) {
    moodEmojis.innerHTML = emojis[mode];
  }

  function displayResponse(response) {
    if (response.response.length > 300) {
      responseOutput.innerHTML = response.response.substring(0, 300) + '... <a href="#" id="read-more">Read more</a>';
      document.getElementById('read-more').addEventListener('click', (e) => {
        e.preventDefault();
        responseOutput.innerHTML = response.response;
      });
    } else {
      responseOutput.innerHTML = response.response;
    }
  }

  // Initial calls when page loads
  updateSuggestions(modes[0]);
  updateSampleImage(modes[0]);
  updateMoodEmoji(modes[0]);
});
