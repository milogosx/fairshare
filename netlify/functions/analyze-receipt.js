exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { imageData, mediaType } = JSON.parse(event.body);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageData
              }
            },
            {
              type: 'text',
              text: 'Analyze this receipt carefully and extract ALL information. Return ONLY a JSON object with this exact structure:\n{\n  "restaurantName": "Restaurant Name",\n  "date": "MM/DD/YYYY",\n  "items": [{"name": "Item name", "price": 3.50, "confidence": 95}],\n  "additionalCosts": [{"name": "Tax", "amount": 5.25}]\n}\n\nFor items: Include ONLY food and drink items. Split quantity items into separate entries. Add a confidence score (0-100) for each item based on how clear it was to read.\nFor additionalCosts: Include tax, tip, service fees, delivery fees, and ANY other non-food/drink charges.\n\nIf the receipt is unreadable or unclear, return: {"error": "Receipt unclear", "items": [], "additionalCosts": []}'
            }
          ]
        }]
      })
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to analyze receipt' })
    };
  }
};
