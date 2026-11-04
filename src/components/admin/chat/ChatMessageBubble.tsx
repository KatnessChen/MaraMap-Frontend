import { ChevronRight, ExternalLink, Search } from "lucide-react";
import { ChatCitation, citationHref, formatMessageTime, splitAnswer, splitBlocks } from "@/utils/chatCitations";

const STATUS_NOTE: Record<string, string> = {
  stopped: "已停止回答",
  truncated: "回答太長，只顯示到這裡",
  failed: "回答時發生問題",
};

interface ChatMessageBubbleProps {
  role: string;
  text: string;
  citations: ChatCitation[];
  status?: string;
  createdAt?: string;
  onContinue?: () => void;
}

export default function ChatMessageBubble({ role, text, citations, status, createdAt, onContinue }: ChatMessageBubbleProps) {
  const time = createdAt && (
    <time dateTime={createdAt} className="font-sans text-sm text-ink/50">
      {formatMessageTime(createdAt)}
    </time>
  );

  if (role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div
          data-testid="chat-user-message"
          className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink text-white px-4 py-3 font-sans text-base leading-relaxed whitespace-pre-wrap break-words"
        >
          {text}
        </div>
        {time}
      </div>
    );
  }

  const note = status ? STATUS_NOTE[status] : undefined;

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        data-testid="chat-assistant-message"
        className="max-w-[92%] sm:max-w-[85%] rounded-2xl rounded-bl-sm bg-white border border-ink/10 px-4 py-3 font-sans text-base leading-relaxed text-ink"
      >
        <div className="space-y-3">
          {splitBlocks(text).map((block, blockIndex) => {
            const content = splitAnswer(block.text, citations).map((segment, index) =>
              segment.type === "text" ? (
                <span key={index}>{segment.text}</span>
              ) : (
                <span key={index} className="group/cite relative inline-block align-super">
                  <a
                    href={citationHref(segment.citation)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`來源 ${segment.number}：${segment.citation.title || "未命名文章"}`}
                    className="text-xs font-bold text-brand hover:underline px-0.5"
                  >
                    {segment.number}
                  </a>
                  <span
                    role="tooltip"
                    className="hidden group-hover/cite:block group-focus-within/cite:block absolute z-20 top-full left-1/2 -translate-x-1/2 mt-1 w-max max-w-64 rounded-lg border border-ink bg-white px-3 py-2 font-sans text-sm font-normal leading-snug text-ink shadow-lg pointer-events-none"
                  >
                    {segment.citation.title || "未命名文章"}
                  </span>
                </span>
              ),
            );
            return block.type === "quote" ? (
              <blockquote
                key={blockIndex}
                className="whitespace-pre-wrap break-words border-l-4 border-brand/50 bg-paper rounded-r-lg px-3 py-2 text-ink-light"
              >
                {content}
              </blockquote>
            ) : (
              <p key={blockIndex} className="whitespace-pre-wrap break-words">
                {content}
              </p>
            );
          })}
        </div>

        {note && <p className="mt-2 font-sans text-sm text-ink/50">{note}</p>}

        {citations.length > 0 && (
          <details className="group/refs mt-3 pt-3 border-t border-ink/10">
            <summary className="flex items-center gap-1 min-h-11 cursor-pointer list-none font-sans text-sm font-bold text-ink/60 hover:text-ink [&::-webkit-details-marker]:hidden">
              <ChevronRight size={16} className="shrink-0 transition-transform group-open/refs:rotate-90" aria-hidden />
              來源文章（{citations.length}）
            </summary>
            <ul className="mt-1 space-y-1" aria-label="來源文章">
            {citations.map((citation, index) => (
              <li key={citation.ref}>
                <a
                  href={citationHref(citation)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 min-h-11 rounded-lg px-2 -mx-2 hover:bg-paper transition-colors"
                >
                  <span className="shrink-0 w-5 text-sm font-bold text-brand">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                    {citation.title || "未命名文章"}
                  </span>
                  {citation.is_hidden && (
                    <span className="shrink-0 rounded-full bg-ink/10 px-2 py-0.5 text-xs font-bold text-ink/60">
                      隱藏
                    </span>
                  )}
                  {citation.event_date && (
                    <span className="shrink-0 hidden sm:inline text-sm text-ink/50">{citation.event_date}</span>
                  )}
                  <ExternalLink size={14} className="shrink-0 text-ink/40" aria-hidden />
                </a>
              </li>
            ))}
            </ul>
          </details>
        )}
      </div>
      {time}
      {onContinue && (
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-2 min-h-11 mt-1 rounded-full border border-ink/15 bg-white px-4 font-sans text-sm font-bold text-ink hover:border-brand hover:text-brand transition-colors"
        >
          <Search size={16} aria-hidden /> 繼續查詢
        </button>
      )}
    </div>
  );
}
