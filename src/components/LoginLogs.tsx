import { useState, useEffect, useMemo } from 'react';
import { getCollection } from '@/lib/firebase/api';
import { LOGIN_LOGS_COLLECTION, type LoginLog } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = 'all';
const pad = (n: number | string) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();

type Parts = { y: string; m: string; d: string };

function startOf(p: Parts): string | null {
  if (p.y === ALL) return null;
  return `${p.y}-${p.m === ALL ? '01' : pad(p.m)}-${p.d === ALL ? '01' : pad(p.d)} 00:00:00`;
}
function endOf(p: Parts): string | null {
  if (p.y === ALL) return null;
  const m = p.m === ALL ? 12 : Number(p.m);
  const d = p.d === ALL ? lastDay(Number(p.y), m) : Number(p.d);
  return `${p.y}-${pad(m)}-${pad(d)} 23:59:59`;
}

function DateSelects({ label, value, onChange, years }: { label: string; value: Parts; onChange: (p: Parts) => void; years: number[] }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="whitespace-nowrap font-bold">{label}</Label>
      <Select value={value.y} onValueChange={y => onChange({ y, m: y === ALL ? ALL : value.m, d: y === ALL ? ALL : value.d })}>
        <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>年(全部)</SelectItem>
          {years.map(y => <SelectItem key={y} value={String(y)}>{y} 年</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={value.m} disabled={value.y === ALL} onValueChange={m => onChange({ ...value, m })}>
        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>月(全部)</SelectItem>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <SelectItem key={m} value={String(m)}>{m} 月</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={value.d} disabled={value.y === ALL} onValueChange={d => onChange({ ...value, d })}>
        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>日(全部)</SelectItem>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d)}>{d} 日</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function LoginLogs() {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState<Parts>({ y: ALL, m: ALL, d: ALL });
  const [to, setTo] = useState<Parts>({ y: ALL, m: ALL, d: ALL });
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      setLogs((await getCollection(LOGIN_LOGS_COLLECTION)) as LoginLog[]);
    } catch (e) {
      console.error('Error loading login logs:', e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    const min = logs.reduce((acc, l) => Math.min(acc, Number((l.loginTime || '').slice(0, 4)) || cur), cur);
    return Array.from({ length: cur - min + 1 }, (_, i) => cur - i);
  }, [logs]);

  const filtered = useMemo(() => {
    const s = startOf(from);
    const e = endOf(to);
    const list = logs.filter(l => (!s || l.loginTime >= s) && (!e || l.loginTime <= e));
    list.sort((a, b) => (sortOrder === 'asc' ? a.loginTime.localeCompare(b.loginTime) : b.loginTime.localeCompare(a.loginTime)));
    return list;
  }, [logs, from, to, sortOrder]);

  useEffect(() => { setPage(1); }, [from, to, sortOrder, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-lg border bg-white">
        <DateSelects label="起始日期" value={from} onChange={setFrom} years={years} />
        <DateSelects label="結束日期" value={to} onChange={setTo} years={years} />
        <Button variant="outline" onClick={() => { setFrom({ y: ALL, m: ALL, d: ALL }); setTo({ y: ALL, m: ALL, d: ALL }); }}>清除條件</Button>
        <Button variant="outline" onClick={load}>重新整理</Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="font-bold">每頁筆數</Label>
          <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => (i + 1) * 10).map(n => <SelectItem key={n} value={String(n)}>{n} 筆</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="font-bold">排序</Label>
          <Select value={sortOrder} onValueChange={v => setSortOrder(v as 'asc' | 'desc')}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">日期由小到大</SelectItem>
              <SelectItem value="desc">日期由大到小</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">共 {filtered.length} 筆</span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一頁</Button>
          <span className="text-sm font-bold">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一頁</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">序號</TableHead>
            <TableHead>帳號</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>登入地點</TableHead>
            <TableHead>登入時間</TableHead>
            <TableHead>登出時間</TableHead>
            <TableHead>備註</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={7} className="text-center h-24">載入中...</TableCell></TableRow>
          ) : paged.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="text-center h-24">查無登入記錄</TableCell></TableRow>
          ) : paged.map((l, index) => (
            <TableRow key={l.id} className={`border-b-2 ${index % 2 === 0 ? '!bg-amber-100 hover:!bg-amber-200 border-amber-300' : '!bg-sky-100 hover:!bg-sky-200 border-sky-300'}`}>
              <TableCell><span className="inline-flex items-center justify-center w-10 h-10 rounded-full font-black text-xl text-white bg-fuchsia-600 border-4 border-fuchsia-200 shadow-md">{(page - 1) * pageSize + index + 1}</span></TableCell>
              <TableCell className="font-bold">{l.username}</TableCell>
              <TableCell>{l.ip || '-'}</TableCell>
              <TableCell>{l.location || '-'}</TableCell>
              <TableCell>{l.loginTime}</TableCell>
              <TableCell>{l.logoutTime || '-'}</TableCell>
              <TableCell className={l.remark ? 'text-rose-700 font-bold' : ''}>{l.remark || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
