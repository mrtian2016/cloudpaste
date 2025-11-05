'use client';

/**
 * 个人信息页面
 */
import { useState } from 'react';
import { User as UserIcon, Mail, Calendar, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Card, CardContent, CardHeader } from '@cloudpaste/shared/components';
import { authApi, formatDate } from '@cloudpaste/shared/lib';
import { useAuthStore } from '@cloudpaste/shared/store';

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: user?.email || '',
    full_name: user?.full_name || '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (formData.password) {
      if (formData.password.length < 6) {
        newErrors.password = '密码至少需要6个字符';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = '两次输入的密码不一致';
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
      const updateData: any = {};
      
      if (formData.email !== user?.email) {
        updateData.email = formData.email || null;
      }
      
      if (formData.full_name !== user?.full_name) {
        updateData.full_name = formData.full_name || null;
      }
      
      if (formData.password) {
        updateData.password = formData.password;
      }

      const updatedUser = await authApi.updateCurrentUser(updateData);
      updateUser(updatedUser);
      
      toast.success('信息更新成功');
      setIsEditing(false);
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (error: any) {
      console.error('更新失败:', error);
      const message = error.response?.data?.detail || '更新失败，请稍后重试';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      email: user?.email || '',
      full_name: user?.full_name || '',
      password: '',
      confirmPassword: '',
    });
    setErrors({});
  };

  if (!user) {
    return null;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* 头部 */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          个人信息
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          查看和编辑你的个人信息
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 用户信息卡片 */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-blue-100 dark:bg-blue-900 rounded-full mb-3 sm:mb-4">
              <UserIcon className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-1">
              {user.username}
            </h2>
            {user.full_name && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
                {user.full_name}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm flex-wrap">
              {user.is_superuser && (
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded whitespace-nowrap">
                  <Shield className="w-3 h-3 inline mr-1" />
                  管理员
                </span>
              )}
              <span className={`px-2 py-1 rounded whitespace-nowrap ${
                user.is_active
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
                {user.is_active ? '已激活' : '未激活'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 详细信息和编辑表单 */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                账户详情
              </h3>
              {!isEditing && (
                <Button onClick={() => setIsEditing(true)} size="sm" className="text-sm">
                  编辑信息
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="邮箱"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={errors.email}
                  placeholder="请输入邮箱"
                  disabled={isLoading}
                />

                <Input
                  label="姓名"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="请输入姓名"
                  disabled={isLoading}
                />

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    修改密码（可选）
                  </p>

                  <div className="space-y-4">
                    <Input
                      label="新密码"
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      error={errors.password}
                      placeholder="留空则不修改密码"
                      disabled={isLoading}
                    />

                    {formData.password && (
                      <Input
                        label="确认新密码"
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        error={errors.confirmPassword}
                        placeholder="请再次输入新密码"
                        disabled={isLoading}
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4">
                  <Button type="submit" isLoading={isLoading} className="w-full sm:w-auto">
                    保存更改
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCancel}
                    disabled={isLoading}
                    className="w-full sm:w-auto"
                  >
                    取消
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">用户名</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">
                      {user.username}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:gap-3">
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">邮箱</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium break-all">
                      {user.email || '未设置'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:gap-3">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">注册时间</p>
                    <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                      {formatDate(user.created_at)}
                    </p>
                  </div>
                </div>

                {user.last_login && (
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">最后登录</p>
                      <p className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">
                        {formatDate(user.last_login)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
