'use client';

/**
 * 注册页面
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@cloudpaste/shared/components/ui/Button';
import { Input } from '@cloudpaste/shared/components/ui/Input';
import { Card, CardContent, CardHeader } from '@cloudpaste/shared/components/ui/Card';
import { authApi } from '@cloudpaste/shared/lib/api';
import { getApiBaseUrl, setApiBaseUrl, getDefaultApiUrl } from '@cloudpaste/shared/lib/apiConfig';

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    apiUrl: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);

  // 初始化时加载已保存的 API URL
  useEffect(() => {
    const currentApiUrl = getApiBaseUrl();
    setFormData((prev) => ({ ...prev, apiUrl: currentApiUrl }));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // 清除错误
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (formData.username.length < 3) {
      newErrors.username = '用户名至少需要3个字符';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少需要6个字符';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    if (!formData.apiUrl.trim()) {
      newErrors.apiUrl = '请输入 API 接口地址';
    } else {
      // 验证 URL 格式
      try {
        new URL(formData.apiUrl);
      } catch {
        newErrors.apiUrl = '请输入有效的 URL 格式 (例如: http://localhost:8000)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    try {
      // 保存 API URL 配置
      setApiBaseUrl(formData.apiUrl);

      await authApi.register({
        username: formData.username,
        password: formData.password,
        email: formData.email || undefined,
        full_name: formData.full_name || undefined,
      });

      toast.success('注册成功！请登录');

      // 跳转到登录页
      router.push('/login');
    } catch (error: any) {
      console.error('注册失败:', error);
      const message = error.response?.data?.detail || '注册失败，请检查配置和信息';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            CloudPaste
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            创建新账户
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                用户注册
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowApiConfig(!showApiConfig)}
                title={showApiConfig ? "隐藏 API 配置" : "显示 API 配置"}
              >
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* API 配置区域 - 可折叠 */}
              {showApiConfig && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300">
                      API 接口配置
                    </h3>
                  </div>
                  <Input
                    label="API 接口地址"
                    name="apiUrl"
                    value={formData.apiUrl}
                    onChange={handleChange}
                    error={errors.apiUrl}
                    placeholder={getDefaultApiUrl()}
                    disabled={isLoading}
                  />
                  <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                    💡 请输入完整的 API 服务地址，例如: http://192.168.1.100:8000
                  </p>
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    如果服务器在局域网内，请使用服务器的局域网 IP 地址
                  </p>
                </div>
              )}

              <Input
                label="用户名 *"
                name="username"
                value={formData.username}
                onChange={handleChange}
                error={errors.username}
                placeholder="请输入用户名（至少3个字符）"
                autoComplete="username"
                disabled={isLoading}
              />

              <Input
                label="邮箱"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="请输入邮箱（可选）"
                autoComplete="email"
                disabled={isLoading}
              />

              <Input
                label="姓名"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="请输入姓名（可选）"
                autoComplete="name"
                disabled={isLoading}
              />

              <Input
                label="密码 *"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                placeholder="请输入密码（至少6个字符）"
                autoComplete="new-password"
                disabled={isLoading}
              />

              <Input
                label="确认密码 *"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                placeholder="请再次输入密码"
                autoComplete="new-password"
                disabled={isLoading}
              />

              {/* 显示当前配置的 API 地址（折叠时） */}
              {!showApiConfig && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  当前 API: {formData.apiUrl || getDefaultApiUrl()}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
              >
                注册
              </Button>

              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                已有账户？{' '}
                <Link
                  href="/login"
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  立即登录
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
