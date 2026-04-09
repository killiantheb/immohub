"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  remainingToday?: number;
}

// Web Speech API — use unknown/any to avoid conflicts with other files
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

export function SphereInput({
  onSend,
  disabled = false,
  placeholder = "Posez votre question à Althy…",
  remainingToday = 30,
}: Props) {
  const [value, setValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<AnySpeechRecognition>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setVoiceSupported("SpeechRecognition" in w || "webkitSpeechRecognition" in w);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function toggleVoice() {
    if (!voiceSupported) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: AnySpeechRecognition = new SR();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend   = () => setIsListening(false);

    recognition.onresult = (e: AnySpeechRecognition) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setValue(transcript);
      // Auto-send on final result
      if (e.results[e.results.length - 1].isFinal) {
        onSend(transcript.trim());
        setValue("");
        recognitionRef.current?.stop();
      }
    };

    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }

  const isEmpty = value.trim().length === 0;

  return (
    <div style={{ width: "100%" }}>
      {/* Rate limit indicator */}
      {remainingToday <= 5 && (
        <div style={{
          textAlign: "center",
          fontSize: 11,
          color: remainingToday === 0 ? "var(--althy-red)" : "var(--althy-amber)",
          marginBottom: 8,
          animation: "fadeIn 0.3s ease",
        }}>
          {remainingToday === 0
            ? "Limite quotidienne atteinte (30/jour). Revenez demain."
            : `${remainingToday} interaction${remainingToday > 1 ? "s" : ""} restante${remainingToday > 1 ? "s" : ""} aujourd'hui`
          }
        </div>
      )}

      {/* Input container */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        background: "var(--althy-surface)",
        border: "1.5px solid var(--althy-border)",
        borderRadius: 16,
        padding: "10px 12px",
        boxShadow: "var(--althy-shadow-md)",
        opacity: disabled ? 0.7 : 1,
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
        onFocus={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--althy-orange)";
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 0 0 3px var(--althy-orange-bg), var(--althy-shadow-md)";
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            (e.currentTarget as HTMLDivElement).style.borderColor = "var(--althy-border)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--althy-shadow-md)";
          }
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Althy réfléchit…" : placeholder}
          disabled={disabled || remainingToday === 0}
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--althy-text)",
            fontSize: 14,
            lineHeight: 1.5,
            fontFamily: "var(--font-sans), DM Sans, sans-serif",
            padding: 0,
          }}
        />

        {/* Voice button */}
        {voiceSupported && (
          <button
            onClick={toggleVoice}
            disabled={disabled || remainingToday === 0}
            title={isListening ? "Arrêter" : "Parler à Althy"}
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              background: isListening ? "var(--althy-orange-bg)" : "transparent",
              color: isListening ? "var(--althy-orange)" : "var(--althy-text-3)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              animation: isListening ? "althyPulse 1s ease-in-out infinite" : "none",
            }}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || isEmpty || remainingToday === 0}
          title="Envoyer"
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: isEmpty || disabled ? "var(--althy-surface-2)" : "var(--althy-orange)",
            color: isEmpty || disabled ? "var(--althy-text-3)" : "white",
            cursor: isEmpty || disabled ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
