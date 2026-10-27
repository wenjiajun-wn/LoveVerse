'use client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// 不解析原始 HTML、不自动加载外部图片、不执行自定义组件/脚本。
export function MarkdownPreview({ source }: { source: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        allowedElements={[
          'p',
          'br',
          'strong',
          'em',
          'del',
          'blockquote',
          'ul',
          'ol',
          'li',
          'h1',
          'h2',
          'h3',
          'h4',
          'pre',
          'code',
          'hr',
          'a',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
        ]}
        components={{ a: ({ children }) => <span className="markdown-link">{children}</span> }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
