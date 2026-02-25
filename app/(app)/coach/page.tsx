"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  getUserProfile,
  getBag,
  getSwingSessions,
} from "@/lib/firebase/firestore";
import { analyseSwings, getClubBreakdown } from "@/lib/swing/analyser";
import { buildCoachContext } from "@/lib/coach/context";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const WELCOME =
  "Ready to work on your game. Ask me anything, or I\u2019ll start with what your data is telling me.";

const QUICK_PROMPTS = [
  "What should I work on?",
  "Analyse my 7 iron",
  "Give me a range plan",
  "Why am I slicing?",
];

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n/g, "<br />");
}

export default function CoachPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [context, setContext] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // Fetch user data and build context
  useEffect(() => {
    if (!user) return;

    async function loadData() {
      const [profile, bag, sessions] = await Promise.all([
        getUserProfile(user!.uid),
        getBag(user!.uid),
        getSwingSessions(user!.uid, 50),
      ]);

      const analysis = analyseSwings(sessions);
      const breakdown = getClubBreakdown(sessions);
      const recentShots = sessions.slice(0, 10);

      const ctx = buildCoachContext({
        handicap: profile?.handicap ?? 18,
        clubs: bag ?? [],
        swingAnalysis: analysis,
        clubBreakdown: breakdown,
        recentShots,
      });

      setContext(ctx);
      setLoadingData(false);
    }

    loadData();
  }, [user]);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function sendMessage(text: string) {
    if (!text.trim() || !context || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setStreaming(true);

    // Add placeholder for coach reply
    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages([...updatedMessages, assistantMsg]);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context,
        }),
      });

      if (!res.ok) {
        let errorMsg = "Something went wrong. Try again.";
        try {
          const err = await res.json();
          if (err.error) errorMsg = err.error;
        } catch {
          // Response wasn't JSON
        }
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: errorMsg,
          };
          return updated;
        });
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.replace(/\r$/, "");
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            console.log("[coach] SSE event:", parsed.type);
            if (
              parsed.type === "content_block_delta" &&
              parsed.delta?.type === "text_delta"
            ) {
              fullText += parsed.delta.text ?? "";
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: fullText,
                };
                return updated;
              });
            }
          } catch (e) {
            console.log("[coach] Parse skip:", data.slice(0, 80), e);
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Connection lost. Check your signal and try again.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-white/50">Loading your swing data...</p>
      </div>
    );
  }

  const showQuickPrompts = messages.length === 0;

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-white/5">
        <h1 className="text-xl font-black text-[#c9a84c]">Coach</h1>
        <p className="text-[11px] text-[#888888]">Powered by Clean Harry</p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Welcome message */}
        <div className="flex justify-start">
          <div className="max-w-[85%] bg-[#1e1e1e] rounded-2xl rounded-tl-sm px-4 py-3">
            <p className="text-sm text-white">{WELCOME}</p>
          </div>
        </div>

        {/* Quick prompts */}
        {showQuickPrompts && (
          <div className="flex flex-wrap gap-2 pl-1">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[#c9a84c]/30 text-[#c9a84c] bg-[#c9a84c]/5 active:bg-[#c9a84c]/15 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-[#c9a84c] text-black rounded-2xl rounded-tr-sm"
                  : "bg-[#1e1e1e] text-white rounded-2xl rounded-tl-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div
                  className="prose-coach"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(msg.content || ""),
                  }}
                />
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {streaming &&
          messages.length > 0 &&
          messages[messages.length - 1].content === "" && (
            <div className="flex justify-start">
              <div className="bg-[#1e1e1e] rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
                <span className="w-2 h-2 bg-[#c9a84c] rounded-full animate-pulse" />
                <span
                  className="w-2 h-2 bg-[#c9a84c] rounded-full animate-pulse"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="w-2 h-2 bg-[#c9a84c] rounded-full animate-pulse"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
            </div>
          )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-white/5 px-4 py-3 pb-20 bg-[#0a0a0a]">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach..."
            disabled={streaming}
            className="flex-1 bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="bg-[#c9a84c] text-black font-bold px-4 rounded-xl transition-colors active:bg-[#b8973b] disabled:opacity-30"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
