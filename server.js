require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const API_KEY = process.env.GEMINI_API_KEY;

async function callGemini(body, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': API_KEY
        },
        body: JSON.stringify(body)
      }
    );

    if (response.status !== 503 || i === retries - 1) {
      return response;
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

// Ask Gemini for JSON and convert it to a JavaScript object
async function askForJson(prompt) {
  const response = await callGemini({
    contents: [{ parts: [{ text: prompt }] }]
  });
  const data = await response.json();

  if (!response.ok) {
    console.log('GEMINI ERROR:', JSON.stringify(data));
    throw new Error('AI error');
  }

  const text = data.candidates[0].content.parts[0].text;
  console.log('RAW AI TEXT:', text);

  // Take only the part between the first [ and the last ]
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) {
    throw new Error('No JSON found');
  }
  return JSON.parse(text.slice(start, end + 1));
}

app.post('/api/summarize', async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes) {
      return res.status(400).json({ error: 'Add some notes first' });
    }

    const response = await callGemini({
      contents: [
        {
          parts: [
            { text: 'Summarize these notes in simple English in 5 bullet points:\n\n' + notes }
          ]
        }
      ]
    });

    const data = await response.json();

    if (!response.ok) {
      console.log(data);
      return res.status(500).json({ error: 'AI error', details: data });
    }

    const summary = data.candidates[0].content.parts[0].text;
    res.json({ summary });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/quiz', async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes) {
      return res.status(400).json({ error: 'Add some notes first' });
    }

    const quiz = await askForJson(
      'Create 5 multiple choice questions from these notes. ' +
      'Return ONLY valid JSON, no extra text, no markdown. ' +
      'Format: [{"question":"...","options":["A","B","C","D"],"answer":0}] ' +
      'where answer is the index (0-3) of the correct option.\n\n' + notes
    );
    res.json({ quiz });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Could not create the quiz, try again' });
  }
});

app.post('/api/flashcards', async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes) {
      return res.status(400).json({ error: 'Add some notes first' });
    }

    const cards = await askForJson(
      'Create 6 flashcards from these notes. ' +
      'Return ONLY valid JSON, no extra text, no markdown. ' +
      'Format: [{"front":"question or term","back":"short answer or meaning"}]\n\n' + notes
    );
    res.json({ cards });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Could not create flashcards, try again' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});