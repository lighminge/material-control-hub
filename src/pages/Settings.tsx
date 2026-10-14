import { useState, useEffect } from 'react';
import { getCollection, setDocumentWithId, updateDocument, deleteDocument } from '@/lib/firebase/api';
import { USERS_COLLECTION, ADMIN_USERNAME, ensureAdmin, hashPassword, type SystemUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type FormState = { username: string; password: string; name: string; unit: string; notes: string };
const emptyForm: FormState = { username: '', password: '', name: '', unit: '', notes: '' };

export default function SettingsPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      await ensureAdmin();
      const data = (await getCollection(USERS_COLLECTION)) as SystemUser[];
      data.sort((a, b) => (a.username === ADMIN_USERNAME ? -1 : b.username === ADMIN_USERNAME ? 1 : a.username.localeCompare(b.username)));
      setUsers(data);
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setIsOpen(true);
  };

  const openEdit = (u: SystemUser) => {
    setForm({ username: u.username, password: '', name: u.name || '', unit: u.unit || '', notes: u.notes || '' });
    setEditingId(u.id || u.username);
    setError('');
    setIsOpen(true);
  };

  const handleSave = async () => {
    const username = form.username.trim();
    if (!username) return setError('帳號為必填欄位');
    if (username.includes('/')) return setError('帳號不可包含 "/" 字元');
    if (!editingId && !form.password) return setError('密碼為必填欄位');
    try {
      if (editingId) {
        const data: any = { name: form.name, unit: form.unit, notes: form.notes };
        if (form.password) data.password = await hashPassword(form.password);
        await updateDocument(USERS_COLLECTION, editingId, data);
      } else {
        if (users.some(u => u.username === username)) return setError('此帳號已存在');
        await setDocumentWithId(USERS_COLLECTION, username, {
          username,
          password: await hashPassword(form.password),
          name: form.name,
          unit: form.unit,
          notes: form.notes
        });
      }
      setIsOpen(false);
      load();
    } catch (e) {
      console.error('Error saving user:', e);
      setError('儲存失敗，請稍後再試');
    }
  };

  const handleDelete = async () => {
    if (!deleteId || deleteId === ADMIN_USERNAME) return;
    await deleteDocument(USERS_COLLECTION, deleteId);
    setDeleteId(null);
    load();
  };

  return (
    <div className="space-y-6">
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>確認刪除</DialogTitle></DialogHeader>
          <div className="py-4">您確定要刪除使用者「{deleteId}」嗎？此動作無法復原。</div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
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
              <Input value={form.username} disabled={!!editingId} onChange={e => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>密碼 {!editingId && <span className="text-destructive">*</span>}</Label>
              <Input type="password" autoComplete="new-password" value={form.password}
                placeholder={editingId ? '不修改請留空' : ''}
                onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
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
              <Button onClick={handleSave}>儲存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-primary">系統設定</h1>
        <Button onClick={openNew}>新增使用者</Button>
      </div>

      <div className="text-lg font-bold">系統使用者</div>
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
                    <Button variant="destructive" size="sm" onClick={() => setDeleteId(u.id || u.username)}>刪除</Button>
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
    </div>
  );
}
