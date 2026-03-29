import { NextRequest } from 'next/server'

export const runtime = 'edge'

async function attemptCoachCall(body: string): Promise<Response> {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body,
  })
}

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()

    const requestBody = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      stream: true,
      system: context || '',
      messages,
    })

    let anthropicResponse = await attemptCoachCall(requestBody)

    // Retry once on overload
    if (!anthropicResponse.ok) {
      const errData = await anthropicResponse.json()

      if (errData.error?.type === 'overloaded_error') {
        await new Promise((r) => setTimeout(r, 2000))
        anthropicResponse = await attemptCoachCall(requestBody)
      }

      if (!anthropicResponse.ok) {
        const msg =
          errData.error?.type === 'overloaded_error'
            ? 'The coach is in high demand right now. Give me a moment and try again.'
            : `Coach error: ${errData.error?.message || 'Unknown error'}`

        return new Response(
          `data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`,
          {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
            },
          }
        )
      }
    }

    const transformer = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk)
      },
    })

    return new Response(anthropicResponse.body!.pipeThrough(transformer), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('Coach route error:', error)
    return new Response(
      `data: ${JSON.stringify({
        type: 'error',
        message: "I'm not available right now. Try again in a moment.",
      })}\n\n`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/event-stream' },
      }
    )
  }
}
