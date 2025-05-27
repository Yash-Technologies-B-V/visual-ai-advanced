document.addEventListener('DOMContentLoaded', () => {
  const promptForm = document.getElementById('prompt-form');
  const promptInput = document.getElementById('prompt-input');
  const modeSlider = document.getElementById('mode-slider');
  const promptSuggestions = document.getElementById('prompt-suggestions');
  const sampleImages = document.getElementById('sample-images');
  const moodEmojis = document.getElementById('mood-emojis');
  const responseOutput = document.getElementById('response-output');

  const modes = ['Simple', 'Creative', 'Analytical', 'Visual'];
  const suggestions = {
    Simple: ['Summarize this', 'Explain simply', 'Give me a quick answer'],
    Creative: ['Generate a story', 'Write a poem', 'Give me creative ideas'],
    Analytical: ['Analyze this data', 'Explain the logic', 'Give me a detailed answer'],
    Visual: ['Generate an image', 'Show me a chart', 'Create a visual representation']
  };
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

  promptForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = promptInput.value;
    const mode = modes[modeSlider.value];

    if (mode === 'Visual') {
      const response = await fetch('/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const { operationLocation } = await response.json();

      const poll = async () => {
        const result = await fetch(operationLocation);
        const data = await result.json();

        if (data.status === 'succeeded') {
          const imageUrl = data.result.data[0].url;
          responseOutput.innerHTML = `<img src="${imageUrl}" alt="Generated Image" style="max-width:100%; border-radius:8px;" />`;
        } else {
          setTimeout(poll, 2000);
        }
      };

      poll();
    } else {
      const response = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode })
      }).then(res => res.json());

      displayResponse(response);
    }
  });

  function updateSuggestions(mode) {
    promptSuggestions.innerHTML = '';
    suggestions[mode].forEach(suggestion => {
      const button = document.createElement('button');
      button.textContent = suggestion;
      button.classList.add('suggestion');
      button.addEventListener('click', () => {
        promptInput.value = suggestion;
      });
      promptSuggestions.appendChild(button);
    });
  }

  function updateSampleImage(mode) {
    sampleImages.innerHTML = `<img src="${images[mode]}" alt="${mode} sample image">`;
  }

  function updateMoodEmoji(mode) {
    moodEmojis.innerHTML = emojis[mode];
  }

  function displayResponse(response) {
    responseOutput.innerHTML = response.response;
  }

  // Initialize with default mode
  updateSuggestions(modes[0]);
  updateSampleImage(modes[0]);
  updateMoodEmoji(modes[0]);
});
