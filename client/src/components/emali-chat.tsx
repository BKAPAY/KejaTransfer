import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, Loader2 } from "lucide-react";
import emaliLogo from "@/assets/emali-ai-logo.png";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MESSAGE = `Bonjour ! Je suis **EMALI**, votre assistant intelligent BKApay. Je suis là pour vous aider. Que souhaitez-vous faire ?

1. Faire un retrait
2. Faire un transfert
3. Consulter mon solde
4. Informations sur les frais
5. Pays et opérateurs disponibles
6. Autre question`;

const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

function isInformationalLine(text: string): boolean {
  if (/:\s*\d/.test(text)) return true;
  if (/\d+\s*(FCFA|XOF|XAF|CDF|USD|EUR|%)/i.test(text)) return true;
  if (/montant|frais|solde|débité|recev|total|récap/i.test(text)) return true;
  return false;
}

function extractOptions(text: string): string[] {
  const lines = text.split("\n");
  const options: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(\d+[\.\)]\s*)(.+)$/);
    if (match) {
      const optText = match[2].trim().replace(/\*\*/g, "").replace(/\*/g, "");
      if (optText.length > 0 && optText.length < 80 && !isInformationalLine(optText)) {
        inList = true;
        options.push(optText);
      } else {
        inList = false;
      }
    } else if (inList && trimmed === "") {
      continue;
    } else if (inList && trimmed.length > 0) {
      inList = false;
    }
  }

  if (options.length >= 2 && options.length <= 20) {
    return options;
  }
  return [];
}

function getOptionLabel(opt: string): string {
  let label = opt.replace(/\(.*?\)\s*$/, "").trim();
  if (label.endsWith(":")) label = label.slice(0, -1).trim();
  return label || opt;
}

export function EmaliChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  const { data: emaliStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/platform-settings/emali-enabled"],
    refetchInterval: 30000,
  });

  const isEmaliEnabled = emaliStatus?.enabled !== false;

  const resetChat = useCallback(() => {
    setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
    setInput("");
    setIsLoading(false);
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!isEmaliEnabled && isOpen) {
      setIsOpen(false);
    }
  }, [isEmaliEnabled, isOpen]);

  const handleOpen = useCallback(() => {
    if (!isEmaliEnabled) return;
    const now = Date.now();
    if (now - lastActivityRef.current > SESSION_TIMEOUT_MS) {
      resetChat();
    }
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [resetChat, isEmaliEnabled]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessageDirect = useCallback(async (text: string, currentMessages: ChatMessage[]) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    lastActivityRef.current = Date.now();
    const newMessages: ChatMessage[] = [...currentMessages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    if (inputRef.current) {
      inputRef.current.style.height = "36px";
    }

    try {
      const response = await fetch("/api/emali-chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur de connexion");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Pas de réponse");

      const decoder = new TextDecoder();
      let assistantContent = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const rawText = decoder.decode(value, { stream: true });
        const lines = rawText.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "balance_update") {
              queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
              queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
              continue;
            }
            if (data.content) {
              assistantContent += data.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                };
                return updated;
              });
              if (
                data.content.includes("Transaction ID:") ||
                data.content.includes("recrédité") ||
                data.content.includes("Retrait") ||
                data.content.includes("Transfert envoyé")
              ) {
                queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
                queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
              }
            }
            if (data.done) break;
            if (data.error) throw new Error(data.error);
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Désolé, je rencontre un problème technique. Veuillez réessayer dans quelques instants.",
        },
      ]);
    } finally {
      setIsLoading(false);
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    await sendMessageDirect(trimmed, messages);
  }, [input, isLoading, messages, sendMessageDirect]);

  const handleQuickReply = useCallback((text: string) => {
    if (isLoading) return;
    sendMessageDirect(text, messages);
  }, [isLoading, messages, sendMessageDirect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");

  const renderMarkdown = (text: string) => {
    let safe = escapeHtml(text);

    // Markdown tables: blocks of consecutive lines starting with | including a |---|---| separator row
    safe = safe.replace(
      /(^|\n)((?:\|[^\n]*\|\s*\n)(?:\|\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|\s*\n)(?:\|[^\n]*\|\s*\n?)+)/g,
      (_match, prefix, block) => {
        const lines = block.trim().split("\n").filter((l: string) => l.trim().length > 0);
        if (lines.length < 2) return prefix + block;
        const parseRow = (line: string) =>
          line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c: string) => c.trim());
        const header = parseRow(lines[0]);
        const bodyRows = lines.slice(2).map(parseRow);
        const th = header
          .map((c: string) =>
            `<th style="text-align:left;padding:6px 8px;font-weight:600;font-size:0.72rem;background:hsl(var(--muted));border-bottom:1px solid hsl(var(--border));color:hsl(var(--muted-foreground));text-transform:uppercase;letter-spacing:0.03em">${c}</th>`
          )
          .join("");
        const trs = bodyRows
          .map(
            (row: string[]) =>
              `<tr>${row
                .map(
                  (c: string, i: number) =>
                    `<td style="padding:6px 8px;font-size:0.78rem;border-bottom:1px solid hsl(var(--border));${i === 0 ? "font-weight:500;" : "text-align:center;color:hsl(var(--foreground))"}">${c === "Néant" ? '<span style="color:hsl(var(--muted-foreground));font-style:italic">Néant</span>' : c}</td>`
                )
                .join("")}</tr>`
          )
          .join("");
        return `${prefix}<div style="overflow-x:auto;margin:6px 0"><table style="width:100%;border-collapse:collapse;border:1px solid hsl(var(--border));border-radius:6px;overflow:hidden"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
      }
    );

    return safe
      // Section headers ## / ###
      .replace(/^#{2,3} (.*?)$/gm, '<div style="font-weight:600;font-size:0.82rem;margin-top:10px;margin-bottom:4px;padding-left:8px;border-left:3px solid hsl(var(--primary));color:hsl(var(--foreground))">$1</div>')
      // Status badges
      .replace(/\[SUCCÈS\]/g, '<span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;background:rgba(34,197,94,0.15);color:#16a34a;font-size:0.72rem;font-weight:700;letter-spacing:0.03em">SUCCÈS</span>')
      .replace(/\[ERREUR\]/g, '<span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;background:rgba(239,68,68,0.15);color:#dc2626;font-size:0.72rem;font-weight:700;letter-spacing:0.03em">ERREUR</span>')
      .replace(/\[EN COURS\]/g, '<span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;background:rgba(234,179,8,0.15);color:#ca8a04;font-size:0.72rem;font-weight:700;letter-spacing:0.03em">EN COURS</span>')
      .replace(/\[INFO\]/g, '<span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;background:rgba(59,130,246,0.15);color:#2563eb;font-size:0.72rem;font-weight:700;letter-spacing:0.03em">INFO</span>')
      // Separator line ─────
      .replace(/─{3,}/g, '<hr style="margin:8px 0;border:none;border-top:1px solid hsl(var(--border))" />')
      // Markdown links
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;background:hsl(var(--primary)/0.1);color:hsl(var(--primary));font-size:0.75rem;font-weight:500;text-decoration:none">$1</a>')
      .replace(/(?<!["\w])(https?:\/\/[^\s&lt;)]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;background:hsl(var(--primary)/0.1);color:hsl(var(--primary));font-size:0.75rem;font-weight:500;text-decoration:none">$1</a>')
      // Bold → primary-colored
      .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:600;color:hsl(var(--foreground))">$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em style="color:hsl(var(--muted-foreground))">$1</em>')
      // Newlines
      .replace(/\n/g, "<br />");
  };

  const isLastAssistantMessage = (index: number) => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i === index;
    }
    return false;
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={isEmaliEnabled ? handleOpen : undefined}
        className={`relative flex flex-col items-center gap-0.5 h-auto px-2 py-1 ${!isEmaliEnabled ? "pointer-events-none" : ""}`}
        data-testid="button-emali-chat"
      >
        <img
          src={emaliLogo}
          alt="EMALI"
          className="w-7 h-7 rounded-full"
        />
        <span className="text-[10px] font-medium text-muted-foreground leading-none">AIDE</span>
      </Button>

      {isOpen && isEmaliEnabled && portalTarget && createPortal(
        <>
          <div
            className="fixed inset-0 z-[10000]"
            onClick={handleClose}
          />
          <div
            className="fixed z-[10001] flex flex-col bg-card border rounded-lg shadow-lg overflow-hidden"
            style={{
              top: "60px",
              left: "70px",
              width: "min(380px, calc(100vw - 90px))",
              height: "min(520px, calc(100vh - 80px))",
            }}
            data-testid="emali-chat-panel"
          >
            <div className="flex items-center justify-between gap-2 p-3 border-b bg-primary/5">
              <div className="flex items-center gap-2">
                <img
                  src={emaliLogo}
                  alt="EMALI"
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <h3 className="font-semibold text-sm">EMALI</h3>
                  <p className="text-xs text-muted-foreground">Assistant BKApay</p>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleClose}
                data-testid="button-close-emali"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-3 space-y-3"
            >
              {messages.map((msg, i) => {
                const showOptions = msg.role === "assistant" && isLastAssistantMessage(i) && !isLoading && msg.content.length > 0;
                const options = showOptions ? extractOptions(msg.content) : [];

                return (
                  <div key={i}>
                    <div
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                        data-testid={`chat-message-${msg.role}-${i}`}
                      >
                        {msg.role === "assistant" ? (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdown(msg.content),
                            }}
                          />
                        ) : (
                          <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                        )}
                        {msg.role === "assistant" && msg.content === "" && isLoading && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                      </div>
                    </div>
                    {options.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
                        {options.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleQuickReply(opt)}
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors cursor-pointer text-left"
                            data-testid={`quick-reply-${i}-${idx}`}
                          >
                            {getOptionLabel(opt)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    const el = e.target;
                    el.style.height = "auto";
                    el.style.height = Math.min(el.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Écrivez votre message..."
                  disabled={isLoading}
                  rows={1}
                  className="flex-1 resize-none !min-h-[36px]"
                  style={{ maxHeight: "120px" }}
                  data-testid="input-emali-message"
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  data-testid="button-send-emali"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>,
        portalTarget
      )}
    </>
  );
}
