const express = require('express');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const port = 3000;

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, 'frontend')));

// Serve index.html on root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// API endpoint
app.get('/api/weather', (req, res) => {
  const city = req.query.city || 'London';
  const pythonScript = path.join(__dirname, 'weather.py');

  exec(`python3 ${pythonScript} ${city}`, (err, stdout, stderr) => {
    if (err || stderr) {
      console.error('Python error:', err || stderr);
      return res.status(500).send('Error fetching weather');
    }

    const weatherData = stdout.split('\n').map(line => {
      const parts = line.split('|');
      if (parts.length === 3) {
        return {
          time: parts[0].trim().replace('Time:', ''),
          temperature: parts[1].trim().replace('Temp:', '').replace('°C', ''),
          weather: parts[2].trim().replace('Weather:', '')
        };
      }
    }).filter(Boolean);

    res.json(weatherData);
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

