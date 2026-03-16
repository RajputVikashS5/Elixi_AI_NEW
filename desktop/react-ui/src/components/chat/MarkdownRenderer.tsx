import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SyntaxCodeBlock = React.lazy(() =>
  import('./SyntaxCodeBlock').then((m) => ({ default: m.SyntaxCodeBlock }))
);

interface MarkdownRendererProps {
  content: string;
  copied: boolean;
  onCopy: (text: string) => void;
}

interface DeferredCodeBlockProps {
  language: string;
  content: string;
  copied: boolean;
  onCopy: (text: string) => void;
}

const DeferredCodeBlock: React.FC<DeferredCodeBlockProps> = ({ language, content, copied, onCopy }) => {
  const [expanded, setExpanded] = React.useState(false);

  if (!expanded) {
    const previewLines = content.split('\n').slice(0, 6).join('\n');
    const hasMore = content.split('\n').length > 6;

    return (
      <div className="relative my-2 overflow-hidden rounded-lg border border-elixi-border">
        <div className="flex items-center justify-between border-b border-elixi-border bg-elixi-bg px-3 py-1.5">
          <span className="font-mono text-xs text-elixi-muted">{language}</span>
          <button
            onClick={() => setExpanded(true)}
            className="no-drag text-xs text-elixi-primary hover:text-sky-300"
          >
            Expand Code
          </button>
        </div>
        <pre className="m-0 overflow-auto bg-[#0f0f1a] p-3 text-xs text-slate-100">
          {previewLines}
          {hasMore ? '\n...' : ''}
        </pre>
      </div>
    );
  }

  return (
    <div className="relative my-2 overflow-hidden rounded-lg border border-elixi-border">
      <div className="flex items-center justify-between border-b border-elixi-border bg-elixi-bg px-3 py-1.5">
        <span className="font-mono text-xs text-elixi-muted">{language}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCopy(content)}
            className="no-drag text-xs text-elixi-muted hover:text-elixi-text"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="no-drag text-xs text-elixi-muted hover:text-elixi-text"
          >
            Collapse
          </button>
        </div>
      </div>
      <React.Suspense
        fallback={<pre className="m-0 overflow-auto bg-[#0f0f1a] p-3 text-xs text-slate-100">{content}</pre>}
      >
        <SyntaxCodeBlock language={language} content={content} />
      </React.Suspense>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, copied, onCopy }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const isBlock = match !== null;
          return isBlock ? (
            <DeferredCodeBlock
              language={match[1]}
              content={String(children).replace(/\n$/, '')}
              copied={copied}
              onCopy={onCopy}
            />
          ) : (
            <code className="bg-elixi-bg px-1.5 py-0.5 rounded text-elixi-accent font-mono text-xs" {...props}>
              {children}
            </code>
          );
        },
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-elixi-text">{children}</li>,
        h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-elixi-text">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold mb-2 text-elixi-text">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 text-elixi-text">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-elixi-primary pl-3 italic text-elixi-muted mb-2">{children}</blockquote>
        ),
        strong: ({ children }) => <strong className="font-semibold text-elixi-text">{children}</strong>,
        a: ({ children }) => (
          <span className="text-elixi-primary underline cursor-pointer">{children}</span>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
