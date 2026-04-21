const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewWrap = document.getElementById('previewWrap');
const previewImg = document.getElementById('previewImg');
const clearBtn = document.getElementById('clearBtn');
const identifyBtn = document.getElementById('identifyBtn');
const spinner = document.getElementById('spinner');
const resultSection = document.getElementById('resultSection');
const errorMsg = document.getElementById('errorMsg');

let selectedFile = null;
let currentPlant = null;
let chatHistory = [];

function showPreview(file) {
  selectedFile = file;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  dropZone.hidden = true;
  previewWrap.hidden = false;
  identifyBtn.disabled = false;
  hideError();
}

function clearAll() {
  selectedFile = null;
  currentPlant = null;
  chatHistory = [];
  fileInput.value = '';
  previewImg.src = '';
  dropZone.hidden = false;
  previewWrap.hidden = true;
  identifyBtn.disabled = true;
  resultSection.hidden = true;
  document.getElementById('chatLog').innerHTML = '';
  document.getElementById('chatInput').value = '';
  hideError();
}

function hideError() {
  errorMsg.hidden = true;
  errorMsg.textContent = '';
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) showPreview(fileInput.files[0]);
});

dropZone.addEventListener('click', e => {
  if (e.target.closest('label')) return;
  fileInput.click();
});

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) showPreview(file);
  else showError('Please drop an image file.');
});

clearBtn.addEventListener('click', clearAll);
document.getElementById('newBtn').addEventListener('click', clearAll);

identifyBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  spinner.hidden = false;
  resultSection.hidden = true;
  identifyBtn.disabled = true;
  hideError();

  const formData = new FormData();
  formData.append('plant_image', selectedFile);

  try {
    const res = await fetch('/identify', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Server error');
    if (data.not_a_plant) throw new Error('No plant detected in this image. Please try a clearer photo of a plant.');

    currentPlant = data;
    chatHistory = [];
    populateResults(data);
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showError(err.message);
  } finally {
    spinner.hidden = true;
    identifyBtn.disabled = false;
  }
});

const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatLog = document.getElementById('chatLog');

function addBubble(text, role) {
  const div = document.createElement('div');
  div.className = `chat-bubble ${role}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function sendChat() {
  const question = chatInput.value.trim();
  if (!question || !currentPlant) return;

  chatInput.value = '';
  chatSendBtn.disabled = true;
  addBubble(question, 'user');

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant: currentPlant, question, history: chatHistory })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');

    chatHistory.push({ role: 'user', content: question });
    chatHistory.push({ role: 'assistant', content: data.answer });
    addBubble(data.answer, 'assistant');
  } catch (err) {
    addBubble('Sorry, something went wrong. Please try again.', 'assistant');
  } finally {
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
}

chatSendBtn.addEventListener('click', sendChat);
chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });

function populateResults(d) {
  document.getElementById('commonName').textContent = d.common_name || 'Unknown Plant';
  document.getElementById('species').textContent = d.species || '';
  document.getElementById('family').textContent = d.family ? `Family: ${d.family}` : '';
  document.getElementById('description').textContent = d.description || '';

  const badge = document.getElementById('confidenceBadge');
  badge.textContent = d.confidence ? `${d.confidence} confidence` : '';
  badge.className = `confidence-badge ${d.confidence || ''}`;

  const toxKids = document.getElementById('toxKids');
  const toxPets = document.getElementById('toxPets');
  const toxLabel = v => v === 'Toxic' ? 'toxic' : v === 'Mildly Toxic' ? 'mild' : v === 'Safe' ? 'safe' : 'unknown';
  toxKids.textContent = d.toxicity?.kids || 'Unknown';
  toxKids.className = `toxicity-badge ${toxLabel(d.toxicity?.kids)}`;
  toxPets.textContent = d.toxicity?.pets || 'Unknown';
  toxPets.className = `toxicity-badge ${toxLabel(d.toxicity?.pets)}`;
  document.getElementById('toxDetails').textContent = d.toxicity?.details || '';

  document.getElementById('lightReq').textContent = d.light?.requirement || '';
  document.getElementById('lightDetails').textContent = d.light?.details || '';

  document.getElementById('waterFreq').textContent = d.watering?.frequency || '';
  document.getElementById('waterDetails').textContent = d.watering?.details || '';

  document.getElementById('careDiff').textContent = d.care?.difficulty || '';
  document.getElementById('careTemp').textContent = d.care?.temperature ? `Temp: ${d.care.temperature}` : '';
  document.getElementById('careHumidity').textContent = d.care?.humidity ? `Humidity: ${d.care.humidity}` : '';

  const tipsList = document.getElementById('careTips');
  tipsList.innerHTML = '';
  (d.care?.tips || []).forEach(tip => {
    const li = document.createElement('li');
    li.textContent = tip;
    tipsList.appendChild(li);
  });
}
