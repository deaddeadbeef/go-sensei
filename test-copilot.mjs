#!/usr/bin/env node
// Quick diagnostic: does the token exchange + Copilot API work?
// Usage: node test-copilot.mjs <github-token>

const githubToken = process.argv[2];
if (!githubToken) {
  console.error('Usage: node test-copilot.mjs <github-token>');
  process.exit(1);
}

// Step 1: Exchange for Copilot token
console.log('Step 1: Exchanging GitHub token for Copilot token...');
const tokenResp = await fetch('https://api.github.com/copilot_internal/v2/token', {
  headers: {
    'authorization': `token ${githubToken}`,
    'editor-version': 'vscode/1.95.0',
    'editor-plugin-version': 'copilot/1.250.0',
    'user-agent': 'GithubCopilot/1.250.0',
  },
});
console.log('Token exchange status:', tokenResp.status);
if (!tokenResp.ok) {
  console.error('Token exchange failed:', await tokenResp.text());
  process.exit(1);
}
const tokenData = await tokenResp.json();
console.log('Got Copilot token, expires:', new Date(tokenData.expires_at * 1000).toISOString());

// Step 2: List available models
console.log('\nStep 2: Checking available models...');
const modelsResp = await fetch('https://api.githubcopilot.com/models', {
  headers: {
    'Authorization': `Bearer ${tokenData.token}`,
    'Copilot-Integration-Id': 'vscode-chat',
    'editor-version': 'vscode/1.95.0',
    'editor-plugin-version': 'copilot/1.250.0',
  },
});
console.log('Models status:', modelsResp.status);
if (modelsResp.ok) {
  const models = await modelsResp.json();
  const modelIds = (models.data || models).map(m => m.id || m.name).filter(Boolean);
  console.log('Available models:', modelIds.join(', '));
} else {
  console.log('Models list failed:', await modelsResp.text());
}

// Step 3: Try a simple chat completion (no tools)
console.log('\nStep 3: Testing simple chat completion with claude-sonnet-4...');
const chatResp = await fetch('https://api.githubcopilot.com/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${tokenData.token}`,
    'Content-Type': 'application/json',
    'Copilot-Integration-Id': 'vscode-chat',
    'editor-version': 'vscode/1.95.0',
    'editor-plugin-version': 'copilot/1.250.0',
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4',
    messages: [{ role: 'user', content: 'Say hello in 5 words.' }],
    max_tokens: 50,
    stream: false,
  }),
});
console.log('Chat status:', chatResp.status);
if (chatResp.ok) {
  const chat = await chatResp.json();
  console.log('Response:', chat.choices?.[0]?.message?.content);
} else {
  const errText = await chatResp.text();
  console.error('Chat failed:', errText);

  // Try with gpt-4o as fallback
  console.log('\nStep 3b: Retrying with gpt-4o...');
  const chatResp2 = await fetch('https://api.githubcopilot.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.token}`,
      'Content-Type': 'application/json',
      'Copilot-Integration-Id': 'vscode-chat',
      'editor-version': 'vscode/1.95.0',
      'editor-plugin-version': 'copilot/1.250.0',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Say hello in 5 words.' }],
      max_tokens: 50,
      stream: false,
    }),
  });
  console.log('Chat status:', chatResp2.status);
  if (chatResp2.ok) {
    const chat2 = await chatResp2.json();
    console.log('Response:', chat2.choices?.[0]?.message?.content);
    console.log('\n⚠️  claude-sonnet-4 not available but gpt-4o works! Update route.ts model.');
  } else {
    console.error('Also failed:', await chatResp2.text());
  }
}

// Step 4: Try with tools
console.log('\nStep 4: Testing with tools...');
const toolModel = 'gpt-4o'; // Use gpt-4o since it's most likely to support tools
const toolChatResp = await fetch('https://api.githubcopilot.com/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${tokenData.token}`,
    'Content-Type': 'application/json',
    'Copilot-Integration-Id': 'vscode-chat',
    'editor-version': 'vscode/1.95.0',
    'editor-plugin-version': 'copilot/1.250.0',
  },
  body: JSON.stringify({
    model: toolModel,
    messages: [{ role: 'user', content: 'What is 2+2? Use the calculator tool.' }],
    tools: [{
      type: 'function',
      function: {
        name: 'calculator',
        description: 'Calculate a math expression',
        parameters: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] },
      },
    }],
    max_tokens: 100,
    stream: false,
  }),
});
console.log(`Tool chat status (${toolModel}):`, toolChatResp.status);
if (toolChatResp.ok) {
  const toolChat = await toolChatResp.json();
  console.log('Response:', JSON.stringify(toolChat.choices?.[0]?.message, null, 2));
} else {
  console.error('Tool chat failed:', await toolChatResp.text());
}

console.log('\nDone!');
