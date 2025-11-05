'use client';

/**
 * 注册页面
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Card, CardContent, CardHeader } from '@cloudpaste/shared/components';
import { authApi } from '@cloudpaste/shared/lib';

export default function RegisterPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    try {
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
      const message = error.response?.data?.detail || '注册失败，请稍后重试';
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              用户注册
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
