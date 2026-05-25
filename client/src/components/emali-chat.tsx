import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { X, Loader2, Receipt, Globe2 } from "lucide-react";
import emaliLogo from "@/assets/emali-ai-logo.png";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MESSAGE = `Bonjour ! Je suis **EMALI**, votre assistant BKApay. Choisissez une option ci-dessous :`;

const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

type QuickAction = {
  id: "fees" | "countries";
  label: string;
  icon: typeof Receipt;
  endpoint: string;
  userMessage: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "fees",
    label: "Informations sur les frais",
    icon: Receipt,
    endpoint: "/api/emali/fees",
    userMessage: "Informations sur les frais",
  },
  {
    id: "countries",
    label: "Pays et opérateurs disponibles",
    icon: Globe2,
    endpoint: "/api/emali/countries-operators",
    userMessage: "Pays et opérateurs disponibles",
  },
];

export function EmaliChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: WELCOME_MESSAGE },
  ]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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
    setLoadingAction(null);
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
  }, [resetChat, isEmaliEnabled]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleQuickAction = useCallback(
    async (action: QuickAction) => {
      if (loadingAction) return;
      lastActivityRef.current = Date.now();
      setLoadingAction(action.id);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: action.userMessage },
        { role: "assistant", content: "" },
      ]);

      try {
        const res = await fetch(action.endpoint, { credentials: "include" });
        if (!res.ok) throw new Error("Réponse invalide");
        const data = (await res.json()) as { content?: string; error?: string };
        if (!data.content) throw new Error(data.error || "Contenu vide");
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: data.content! };
          return updated;
        });
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Désolé, je n'ai pas pu récupérer ces informations. Veuillez réessayer dans quelques instants.",
          };
          return updated;
        });
      } finally {
        setLoadingAction(null);
      }
    },
    [loadingAction],
  );

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");

  const renderMarkdown = (text: string) => {
    let safe = escapeHtml(text);

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
          .map(
            (c: string) =>
              `<th style="text-align:left;padding:6px 8px;font-weight:600;font-size:0.72rem;background:hsl(var(--muted));border-bottom:1px solid hsl(var(--border));color:hsl(var(--muted-foreground));text-transform:uppercase;letter-spacing:0.03em">${c}</th>`,
          )
          .join("");
        const trs = bodyRows
          .map(
            (row: string[]) =>
              `<tr>${row
                .map(
                  (c: string, i: number) =>
                    `<td style="padding:6px 8px;font-size:0.78rem;border-bottom:1px solid hsl(var(--border));${i === 0 ? "font-weight:500;" : "text-align:center;color:hsl(var(--foreground))"}">${c === "Néant" ? '<span style="color:hsl(var(--muted-foreground));font-style:italic">Néant</span>' : c}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("");
        return `${prefix}<div style="overflow-x:auto;margin:6px 0"><table style="width:100%;border-collapse:collapse;border:1px solid hsl(var(--border));border-radius:6px;overflow:hidden"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
      },
    );

    return safe
      .replace(
        /^#{2,3} (.*?)$/gm,
        '<div style="font-weight:600;font-size:0.82rem;margin-top:10px;margin-bottom:4px;padding-left:8px;border-left:3px solid hsl(var(--primary));color:hsl(var(--foreground))">$1</div>',
      )
      .replace(/─{3,}/g, '<hr style="margin:8px 0;border:none;border-top:1px solid hsl(var(--border))" />')
      .replace(
        /\*\*(.*?)\*\*/g,
        '<strong style="font-weight:600;color:hsl(var(--foreground))">$1</strong>',
      )
      .replace(/\*(.*?)\*/g, '<em style="color:hsl(var(--muted-foreground))">$1</em>')
      .replace(/\n/g, "<br />");
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={isEmaliEnabled ? handleOpen : undefined}
        className={`relative flex flex-col items-center gap-0.5 h-auto px-2 py-1 ${!isEmaliEnabled ? "pointer-events-none" : ""}`}
        data-testid="button-emali-chat"
      >
        <img src={emaliLogo} alt="EMALI" className="w-7 h-7 rounded-full" />
        <span className="text-[10px] font-medium text-muted-foreground leading-none">AIDE</span>
      </Button>

      {isOpen && isEmaliEnabled && portalTarget &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[10000]" onClick={handleClose} />
            <div
              className="fixed z-[10001] bg-background border rounded-lg shadow-2xl flex flex-col"
              style={{
                top: "60px",
                right: "10px",
                width: "min(380px, calc(100vw - 20px))",
                height: "min(560px, calc(100vh - 80px))",
              }}
              data-testid="emali-chat-panel"
            >
              <div className="flex items-center justify-between gap-2 p-3 border-b bg-primary/5">
                <div className="flex items-center gap-2">
                  <img src={emaliLogo} alt="EMALI" className="w-8 h-8 rounded-full" />
                  <div>
                    <h3 className="font-semibold text-sm">EMALI</h3>
                    <p className="text-xs text-muted-foreground">Assistant BKApay</p>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={handleClose} data-testid="button-close-emali">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                      data-testid={`chat-message-${msg.role}-${i}`}
                    >
                      {msg.role === "assistant" ? (
                        msg.content === "" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdown(msg.content),
                            }}
                          />
                        )
                      ) : (
                        <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t bg-background/95 backdrop-blur space-y-2">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  const busy = loadingAction === action.id;
                  return (
                    <Button
                      key={action.id}
                      variant="outline"
                      onClick={() => handleQuickAction(action)}
                      disabled={!!loadingAction}
                      className="w-full justify-start gap-2"
                      data-testid={`button-emali-${action.id}`}
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                      <span className="text-left">{action.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </>,
          portalTarget,
        )}
    </>
  );
}
