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

        const { operationLocation } = await response.json();
        console.log('🛰️ operationLocation:', operationLocation);

        const poll = async () => {
          try {
            const result = await fetch(`/image-status?url=${encodeURIComponent(operationLocation)}`);
            const data = await result.json();
            console.log('📡 Polling result:', data);

            if (data.status === 'succeeded') {
              const imageUrl = data.result.data[0].url;
              responseOutput.innerHTML = `<img src="${imageUrl}" alt="Generated Image" style="max-width:100%; border-radius:8px;" />`;
            } else if (data.status === 'failed') {
              responseOutput.innerHTML = 'Image generation failed. Please try again.';
            } else {
              setTimeout(poll, 2000);
            }
          } catch (err) {
            console.error('❌ Polling error:', err);
            responseOutput.innerHTML = 'Error polling image status.';
          }
        };

        poll();
      } catch (err) {
        console.error('❌ Image generation error:', err);
        responseOutput.innerHTML = 'Image generation failed.';
      }
    } else {
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

  updateSuggestions(modes[0]);
  updateSampleImage(modes[0]);
  updateMoodEmoji(modes[0]);
});
