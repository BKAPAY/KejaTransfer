import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, Loader2 } from "lucide-react";
import emaliLogo from "@/assets/emali-ai-logo.png";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MESSAGE = `Bonjour ! Je suis **EMALI AI**, votre assistant intelligent BKApay. Je suis là pour répondre à toutes vos questions sur la plateforme : pays disponibles, opérateurs, frais de transaction, cryptomonnaies, vérification KYC, et bien plus encore.

Comment puis-je vous aider aujourd'hui ?`;

const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

function extractOptions(text: string): string[] {
  const lines = text.split("\n");
  const options: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:\d+[\.\)]\s*|[-•]\s+)(.+)$/);
    if (match) {
      inList = true;
      let optText = match[1].trim();
      optText = optText.replace(/\*\*/g, "").replace(/\*/g, "");
      if (optText.length > 0 && optText.length < 80) {
        options.push(optText);
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetChat = useCallback(() => {
    setMessages([{ role: "assistant", content: WELCOME_MESSAGE }]);
    setInput("");
    setIsLoading(false);
    lastActivityRef.current = Date.now();
  }, []);

  const handleOpen = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current > SESSION_TIMEOUT_MS) {
      resetChat();
    }
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [resetChat]);

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

  const renderMarkdown = (text: string) => {
    return text
      .replace(/### (.*?)(\n|$)/g, '<strong class="text-sm block mt-2 mb-1">$1</strong>')
      .replace(/## (.*?)(\n|$)/g, '<strong class="text-sm block mt-2 mb-1">$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 mt-1 mb-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors" style="text-decoration:none">$1</a>')
      .replace(/(?<!["\w])(https?:\/\/[^\s<)]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 mt-1 mb-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors" style="text-decoration:none">$1</a>')
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
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
        size="icon"
        variant="ghost"
        onClick={handleOpen}
        className="relative"
        data-testid="button-emali-chat"
      >
        <img
          src={emaliLogo}
          alt="EMALI AI"
          className="w-7 h-7 rounded-full"
        />
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={handleClose}
          />
          <div
            className="fixed z-50 flex flex-col bg-card border rounded-lg shadow-lg overflow-hidden"
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
                  alt="EMALI AI"
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <h3 className="font-semibold text-sm">EMALI AI</h3>
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
        </>
      )}
    </>
  );
}
