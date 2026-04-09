"use client";

import { useEffect, useRef } from "react";

interface Props {
  text: string;
  isStreaming: boolean;
  userMessage?: string;
}

export function SphereStream({ text, isStreaming, userMessage }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [text]);

  if (!text && !userMessage) return null;

  return (
    <div style={{ width: "100%", maxWidth: 640, margin: "0 auto" }}>
      {/* User message */}
      {userMessage && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 16,
            animation: "slideUp 0.25s ease",
          }}
        >
          <div
            style={{
              background: "var(--althy-orange)",
              color: "white",
              borderRadius: "16px 16px 4px 16px",
              padding: "10px 16px",
              maxWidth: "75%",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {userMessage}
          </div>
        </div>
      )}

      {/* AI response */}
      {text && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            animation: "slideUp 0.25s ease",
          }}
        >
          <div
            style={{
              background: "var(--althy-surface)",
              border: "1px solid var(--althy-border)",
              borderRadius: "4px 16px 16px 16px",
              padding: "12px 16px",
              maxWidth: "85%",
              boxShadow: "var(--althy-shadow)",
            }}
          >
            {/* Render text with newlines */}
            {text.split("\n").map((line, i) => (
              <span key={i}>
                {line}
                {i < text.split("\n").length - 1 && <br />}
              </span>
            ))}
            {/* Typing cursor */}
            {isStreaming && (
              <span
                style={{
                  display: "inline-block",
                  width: 2,
                  height: "1em",
                  background: "var(--althy-orange)",
                  marginLeft: 2,
                  verticalAlign: "text-bottom",
                  animation: "althyPulse 0.7s step-end infinite",
                }}
              />
            )}
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
