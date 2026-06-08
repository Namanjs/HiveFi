#!/bin/bash
set -e

echo "Installing dependencies..."
npm install > /dev/null 2>&1

echo "Starting mock Ollama server..."
node mock_ollama.js &
OLLAMA_PID=$!
sleep 2

# Test 1: Missing Env
echo -e "\n=== Testing Missing Environment Variables ==="
rm -f .env
npx ts-node src/index.ts || echo "Exited with failure as expected."

# Test 2: Valid Env
echo "MODEL_ID=tinyllama
NICHE=SQL
WALLET=0xMockSpecialistWallet123
PRICE_PER_QUERY=0.05
BACKEND=ollama
OLLAMA_BASE_URL=http://localhost:11434
PORT=4000
AUTH_SECRET=my-super-secret-auth-key" > .env

echo -e "\n=== Starting HiveFi Specialist Node ==="
npx ts-node src/index.ts &
NODE_PID=$!
sleep 4

echo -e "\n=== Testing GET /health (Unauthenticated) ==="
curl -s http://127.0.0.1:4000/health | node -e "const chunks=[]; process.stdin.on('data', c=>chunks.push(c)); process.stdin.on('end', ()=>console.log(JSON.stringify(JSON.parse(Buffer.concat(chunks).toString()), null, 2)))"

echo -e "\n=== Testing POST /execute (Unauthenticated - Should Fail 401) ==="
curl -s -X POST http://127.0.0.1:4000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a SQL query to get the top 5 highest paid employees",
    "niche": "SQL"
  }' | node -e "const chunks=[]; process.stdin.on('data', c=>chunks.push(c)); process.stdin.on('end', ()=>console.log(JSON.stringify(JSON.parse(Buffer.concat(chunks).toString()), null, 2)))"

echo -e "\n=== Testing POST /execute (Authenticated - Should Succeed) ==="
curl -s -X POST http://127.0.0.1:4000/execute \
  -H "Content-Type: application/json" \
  -H "x-auth-secret: my-super-secret-auth-key" \
  -d '{
    "prompt": "Write a SQL query to get the top 5 highest paid employees",
    "niche": "SQL"
  }' | node -e "const chunks=[]; process.stdin.on('data', c=>chunks.push(c)); process.stdin.on('end', ()=>console.log(JSON.stringify(JSON.parse(Buffer.concat(chunks).toString()), null, 2)))"

echo -e "\n=== Testing Invalid Niche (Authenticated - Should Fail Niche Mismatch) ==="
curl -s -X POST http://127.0.0.1:4000/execute \
  -H "Content-Type: application/json" \
  -H "x-auth-secret: my-super-secret-auth-key" \
  -d '{
    "prompt": "Write a python script",
    "niche": "PYTHON"
  }' | node -e "const chunks=[]; process.stdin.on('data', c=>chunks.push(c)); process.stdin.on('end', ()=>console.log(JSON.stringify(JSON.parse(Buffer.concat(chunks).toString()), null, 2)))"

echo -e "\nCleaning up..."
kill $NODE_PID
kill $OLLAMA_PID
wait $NODE_PID 2>/dev/null || true
wait $OLLAMA_PID 2>/dev/null || true
echo "Test completed."
