'use client';

/**
 * 登录页面
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Card, CardContent, CardHeader } from '@cloudpaste/shared/components';
import { authApi, deviceApi, generateDeviceId, getDeviceName } from '@cloudpaste/shared/lib';
import { useAuthStore } from '@cloudpaste/shared/store';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
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
    }

    if (!formData.password) {
      newErrors.password = '请输入密码';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);

    try {
      // 登录
      const tokenResponse = await authApi.login(formData);
      
      // 获取用户信息
      localStorage.setItem('access_token', tokenResponse.access_token);
      const user = await authApi.getCurrentUser();
      
      // 保存认证信息
      setAuth(user, tokenResponse.access_token);

      // 🆕 注册设备
      try {
        const deviceId = generateDeviceId();
        const deviceName = getDeviceName();

        await deviceApi.register({
          device_id: deviceId,
          device_name: deviceName,
          device_type: 'web',
        });

        console.log('✅ 设备注册成功');
      } catch (error) {
        console.error('❌ 设备注册失败:', error);
        // 不阻断登录流程，设备可以稍后注册
      }

      toast.success('登录成功！');

      // 跳转到主页
      router.push('/dashboard');
    } catch (error: any) {
      console.error('登录失败:', error);
      const message = error.response?.data?.detail || '登录失败，请检查用户名和密码';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            CloudPaste
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            登录到你的账户
          </p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              用户登录
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="用户名"
                name="username"
                value={formData.username}
                onChange={handleChange}
                error={errors.username}
                placeholder="请输入用户名"
                autoComplete="username"
                disabled={isLoading}
              />

              <Input
                label="密码"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                placeholder="请输入密码"
                autoComplete="current-password"
                disabled={isLoading}
              />

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
              >
                登录
              </Button>

              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                还没有账户？{' '}
                <Link
                  href="/register"
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  立即注册
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
