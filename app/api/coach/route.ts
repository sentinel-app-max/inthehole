import { NextRequest, NextResponse } from "next/server";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface CoachRequest {
  messages: Message[];
  context: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }

  let body: CoachRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!body.messages || !Array.isArray(body.messages) || !body.context) {
    return NextResponse.json(
      { error: "Missing messages or context" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: body.context,
        messages: body.messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Anthropic API error:", response.status, error);
      return NextResponse.json(
        { error: "AI service error" },
        { status: response.status }
      );
    }

    if (!response.body) {
      return NextResponse.json(
        { error: "No response stream" },
        { status: 502 }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (err) {
          console.error("Stream read error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Coach API error:", err);
    return NextResponse.json(
      { error: "Failed to reach AI service" },
      { status: 502 }
    );
  }
}
