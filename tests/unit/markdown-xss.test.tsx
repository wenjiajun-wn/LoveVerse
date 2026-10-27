import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownPreview } from '../../src/components/memory-editor/markdown-preview';
import { Highlight } from '../../src/components/memory-manager';
describe('Markdown 与搜索高亮的 XSS 防护', () => {
  it('不渲染原始脚本、事件处理器、SVG、iframe 或跟踪图片', () => {
    const html = renderToStaticMarkup(
      <MarkdownPreview
        source={
          '# 正常标题\n\n<script>alert(1)</script>\n<img src=x onerror="alert(1)">\n<svg onload="alert(1)"></svg>\n<iframe src="https://evil.example"></iframe>\n\n![tracking](https://evil.example/pixel)\n\n[点击](javascript:alert(1))'
        }
      />,
    );
    expect(html).toContain('正常标题');
    expect(html).not.toMatch(/<script|<img|<svg|<iframe|onerror|onload|href=/);
  });
  it('高亮文本通过 React 转义而非拼接 HTML', () => {
    const html = renderToStaticMarkup(
      <Highlight text={'<img src=x onerror=alert(1)>海边'} query={'海边'} />,
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('<mark>海边</mark>');
  });
});
