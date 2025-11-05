/**
 * HTML 内容处理工具函数
 */

/**
 * 检测内容是否为 HTML
 */
export function isHTMLContent(content: string): boolean {
  return content.trim().startsWith('<') && content.includes('>');
}

/**
 * 检测是否为 IDE 格式化代码（VS Code 等复制的带样式代码）
 */
export function isIDEFormattedCode(html: string): boolean {
  return html.includes('<meta charset') && 
         html.includes('style=') && 
         (html.includes('background-color') || html.includes('font-family'));
}

/**
 * 从 HTML 中提取纯文本
 */
export function extractTextFromHTML(html: string): string {
  // 创建一个临时 div 来解析 HTML
  if (typeof document !== 'undefined') {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // 在块级元素后添加换行符
    const blockElements = temp.querySelectorAll('div, p, br, h1, h2, h3, h4, h5, h6, li, tr');
    blockElements.forEach((el) => {
      if (el.tagName === 'BR') {
        el.replaceWith('\n');
      } else {
        // 在块级元素后添加换行符
        const textNode = document.createTextNode('\n');
        el.after(textNode);
      }
    });
    
    return (temp.textContent || temp.innerText || '').trim();
  }
  
  // 服务端降级方案：先在块级标签处添加换行，再移除标签
  return html
    .replace(/<meta[^>]*>/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
    // 在块级元素结束标签前添加换行符
    .replace(/<\/(div|p|h[1-6]|li|tr)>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    // 移除所有 HTML 标签
    .replace(/<[^>]+>/g, '')
    // 处理 HTML 实体
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    // 清理多余空行
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * 美化显示内容（智能处理 HTML）
 */
export function beautifyContent(content: string): {
  displayText: string;
  isCode: boolean;
  language?: string;
} {
  // 检测是否为 HTML
  if (!isHTMLContent(content)) {
    return {
      displayText: content,
      isCode: false,
    };
  }

  // 检测是否为 IDE 格式化代码
  if (isIDEFormattedCode(content)) {
    const plainText = extractTextFromHTML(content);
    return {
      displayText: plainText,
      isCode: true, // 标记为代码，可以用代码样式显示
    };
  }

  // 普通 HTML 内容 - 提取文本
  const plainText = extractTextFromHTML(content);
  
  // 如果提取后的文本很短，可能是有用的 HTML，保留原样
  if (plainText.length < 50 && content.length > plainText.length * 2) {
    return {
      displayText: content,
      isCode: false,
    };
  }

  return {
    displayText: plainText,
    isCode: false,
  };
}

/**
 * 检测是否为代码片段（简单启发式）
 */
export function looksLikeCode(text: string): boolean {
  const codeIndicators = [
    /function\s+\w+\s*\(/,
    /const\s+\w+\s*=/,
    /let\s+\w+\s*=/,
    /var\s+\w+\s*=/,
    /class\s+\w+/,
    /import\s+.*from/,
    /export\s+(default|const|class|function)/,
    /<\/?\w+[^>]*>/,  // HTML 标签
    /\{\s*\n/,  // 代码块
  ];

  return codeIndicators.some(pattern => pattern.test(text));
}
