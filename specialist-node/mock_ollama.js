const http = require('http');

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          model: data.model || 'unknown',
          response: `Mock response from JS Ollama: SELECT * FROM employees ORDER BY salary DESC LIMIT 5;`
        }));
      } catch (err) {
        res.writeHead(500);
        res.end(err.toString());
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(11434, '127.0.0.1', () => {
  console.log('Mock Ollama running on port 11434');
});
