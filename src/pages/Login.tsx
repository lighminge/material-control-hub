import { useState } from 'react';
import { login, type SessionUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function Login({ onSuccess }: { onSuccess: (u: SessionUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('請輸入帳號及密碼');
      return;
    }
    setLoading(true);
    setError('');
    try {
      onSuccess(await login(username, password));
    } catch (err: any) {
      setError(err?.message === '帳號或密碼錯誤' ? err.message : '登入失敗，請檢查網路連線後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-8 space-y-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary">Material Hub</div>
            <div className="text-muted-foreground mt-2">登入系統</div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-username">帳號</Label>
              <Input id="login-username" autoFocus autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">密碼</Label>
              <Input id="login-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <div className="text-sm font-bold text-destructive">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? '登入中...' : '登入'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
