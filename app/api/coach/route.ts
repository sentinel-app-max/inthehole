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
    console.error("[coach] ANTHROPIC_API_KEY not set");
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

  console.log(
    "[coach] Calling Anthropic API with",
    body.messages.length,
    "messages"
  );

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

    console.log("[coach] Anthropic response status:", response.status);
    console.log(
      "[coach] Anthropic response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        "[coach] Anthropic API error body (full):",
        response.status,
        errorBody
      );
      return NextResponse.json(
        { error: "AI service error", detail: errorBody },
        { status: response.status }
      );
    }

    if (!response.body) {
      console.error("[coach] Response body is null");
      return NextResponse.json(
        { error: "No response stream" },
        { status: 502 }
      );
    }

    console.log("[coach] Piping stream to client");

    const decoder = new TextDecoder();

    // Transform stream to log full chunk content
    const transformer = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        console.log("[coach] Chunk:", text);
        controller.enqueue(chunk);
      },
    });

    const piped = response.body.pipeThrough(transformer);

    return new Response(piped, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[coach] Fetch error:", err);
    return NextResponse.json(
      { error: "Failed to reach AI service" },
      { status: 502 }
    );
  }
}
