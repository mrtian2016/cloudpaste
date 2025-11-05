/**
 * 文本文件加载 Hook
 * 通过 API 获取文件内容
 */
import { useState, useEffect } from 'react';
import { fileApi } from '../lib/api';
import { extractFileId } from '../lib/imageUtils';

export function useTextFileLoader(fileUrl: string | null) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!fileUrl) {
      setTextContent(null);
      return;
    }

    let isMounted = true;

    const loadText = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const fileId = extractFileId(fileUrl);

        if (!fileId) {
          throw new Error('Invalid file URL');
        }

        const content = await fileApi.getTextContent(fileId);

        if (isMounted) {
          setTextContent(content);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
          setTextContent(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadText();

    return () => {
      isMounted = false;
    };
  }, [fileUrl]);

  return { textContent, isLoading, error };
}
