require('dotenv').config();
const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only image files are allowed'));
  }
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.static(path.join(__dirname, 'public')));

app.post('/identify', upload.single('plant_image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  try {
    const base64Image = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image
              }
            },
            {
              type: 'text',
              text: `Identify this plant and provide information in the following JSON format only, no other text:
{
  "common_name": "string",
  "species": "string",
  "family": "string",
  "confidence": "high|medium|low",
  "description": "1-2 sentence description",
  "toxicity": {
    "kids": "Safe|Toxic|Mildly Toxic|Unknown",
    "pets": "Safe|Toxic|Mildly Toxic|Unknown",
    "details": "brief explanation of toxic parts or reassurance if safe"
  },
  "light": {
    "requirement": "Full Sun|Partial Sun|Indirect Light|Low Light",
    "details": "specific light guidance"
  },
  "watering": {
    "frequency": "e.g. Every 7-10 days",
    "details": "specific watering guidance"
  },
  "care": {
    "difficulty": "Easy|Moderate|Challenging",
    "temperature": "ideal temperature range",
    "humidity": "low|medium|high",
    "tips": ["tip 1", "tip 2", "tip 3"]
  },
  "not_a_plant": false
}

If the image does not contain a plant, set "not_a_plant" to true and fill other fields with empty strings.

Note: ignore any decorative moss visible in the pot — do not interpret it as a sign that the plant is root-bound or in need of repotting.`
            }
          ]
        }
      ]
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse plant data');

    const plantData = JSON.parse(jsonMatch[0]);
    res.json(plantData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to identify plant' });
  }
});

app.post('/chat', express.json(), async (req, res) => {
  const { plant, question, history = [] } = req.body;
  if (!question || !plant) return res.status(400).json({ error: 'Missing question or plant data' });

  const systemPrompt = `You are a helpful plant care assistant. The user has identified the following plant:
Name: ${plant.common_name} (${plant.species})
Family: ${plant.family}
Description: ${plant.description}
Light: ${plant.light?.requirement} — ${plant.light?.details}
Watering: ${plant.watering?.frequency} — ${plant.watering?.details}
Care difficulty: ${plant.care?.difficulty}
Temperature: ${plant.care?.temperature}
Humidity: ${plant.care?.humidity}
Tips: ${(plant.care?.tips || []).join('; ')}

Answer questions about this plant concisely and helpfully.`;

  const messages = [
    ...history,
    { role: 'user', content: question }
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages
    });

    const answer = response.content[0].text.trim();
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to get answer' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Plant ID app running at http://localhost:${PORT}`);
  });
}

module.exports = app;
