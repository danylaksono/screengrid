export async function requestAssistantProposal({ baseUrl, apiKey, model, temperature, prompt, spec, tools }) {
  if (!apiKey) {
    throw new Error('Provide an API key or use Local Suggestion.');
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You are a Screengrid visualization co-pilot.',
            'Return only JSON with keys: summary, rationale, actions, warnings.',
            'Actions must contain JSON Patch operations against the provided Screengrid Design Spec.',
            'Do not generate JavaScript or arbitrary drawing code.',
            'For freeform glyphs, patch /glyph/type to "custom" and /glyph/custom to a grammar object with layout cartesian-mini or radial, and marks line, point, wedge, or ring.',
            `Available client tools are: ${tools.join(', ')}.`
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify({
            userIntent: prompt,
            currentSpec: spec,
            allowedPatchRoots: ['/screengrid', '/glyph', '/interaction']
          })
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Provider request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('Provider returned no message content.');
  return JSON.parse(content);
}
