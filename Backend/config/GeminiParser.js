// utils/parseAIResponse.js
export function parseAIResponse(response) {
  // OpenAI style
  if (response?.choices?.[0]?.message?.content) {
    return response.choices[0].message.content;
  }

  // Gemini style (content array with text parts)
  if (response?.choices?.[0]?.message?.content?.[0]?.text) {
    return response.choices[0].message.content[0].text;
  }

  return null; // fallback
}
