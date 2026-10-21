import { useState, useEffect } from 'react';
import { getCollection, updateDocument, deleteDocument } from '@/lib/firebase/api';
import { USERS_COLLECTION, ADMIN_USERNAME, createSystemUser, getSession, type UserProfile } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoginLogs from '@/components/LoginLogs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type FormState = { username: string; password: string; name: string; unit: string; notes: string };
const emptyForm: FormState = { username: '', password: '', name: '', unit: '', notes: '' };

export default function SettingsPage() {
  const isAdmin = getSession()?.role === 'admin';
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = (await getCollection(USERS_COLLECTION)) as UserProfile[];
      data.sort((a, b) => (a.username === ADMIN_USERNAME ? -1 : b.username === ADMIN_USERNAME ? 1 : a.username.localeCompare(b.username)));
      setUsers(data);
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (!isAdmin) {
    return <div className="text-lg font-bold text-destructive">您沒有權限使用「系統設定」，請聯絡管理員。</div>;
  }

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setIsOpen(true);
  };

  const openEdit = (u: UserProfile) => {
    setForm({ username: u.username, password: '', name: u.name || '', unit: u.unit || '', notes: u.notes || '' });
    setEditingId(u.id || null);
    setError('');
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim()) return setError('帳號為必填欄位');
    if (!editingId && !form.password) return setError('密碼為必填欄位');
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await updateDocument(USERS_COLLECTION, editingId, { name: form.name, unit: form.unit, notes: form.notes });
      } else {
        await createSystemUser(form);
      }
      setIsOpen(false);
      load();
    } catch (e: any) {
      console.error('Error saving user:', e);
      setError(e?.message || '儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id || deleteTarget.username === ADMIN_USERNAME) return;
    await deleteDocument(USERS_COLLECTION, deleteTarget.id);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-6">
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>確認刪除</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2">
            <div>您確定要刪除使用者「{deleteTarget?.username}」嗎？刪除後該帳號將無法登入系統。</div>
            <div className="text-sm text-muted-foreground">
              若之後要用相同帳號重新建立，請先到 Firebase Console → Authentication 刪除該帳號。
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>確認刪除</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? '編輯使用者' : '新增使用者'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>帳號 <span className="text-destructive">*</span></Label>
              <Input value={form.username} disabled={!!editingId} placeholder="英文字母、數字、. _ -"
                onChange={e => setForm({ ...form, username: e.target.value })} />
            </div>
            {!editingId && (
              <div className="space-y-2">
                <Label>密碼 <span className="text-destructive">*</span></Label>
                <Input type="password" autoComplete="new-password" value={form.password} placeholder="至少 6 個字元"
                  onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
            {editingId && (
              <div className="text-sm text-muted-foreground">密碼無法在此修改，需要重設請至 Firebase Console → Authentication。</div>
            )}
            <div className="space-y-2">
              <Label>名稱</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>單位</Label>
              <Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>備註</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            {error && <div className="text-sm font-bold text-destructive">{error}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>取消</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? '儲存中...' : '儲存'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <h1 className="text-3xl font-bold tracking-tight text-primary">系統設定</h1>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">系統使用者</TabsTrigger>
          <TabsTrigger value="loginLogs">系統登入記錄</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Button onClick={openNew}>新增使用者</Button>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">操作</TableHead>
                <TableHead>帳號</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead>單位</TableHead>
                <TableHead>備註</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">載入中...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">尚無使用者</TableCell></TableRow>
              ) : users.map(u => (
                <TableRow key={u.id || u.username}>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(u)}>編輯</Button>
                      {u.username !== ADMIN_USERNAME && (
                        <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(u)}>刪除</Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">
                    {u.username}
                    {u.username === ADMIN_USERNAME && <span className="ml-2 text-xs text-primary">(管理員)</span>}
                  </TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.unit}</TableCell>
                  <TableCell>{u.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="loginLogs">
          <LoginLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
