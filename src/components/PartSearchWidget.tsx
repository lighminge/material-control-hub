import { useState, useEffect } from 'react';
import { getCollection, updateDocument, addDocument } from '@/lib/firebase/api';
import type { Material } from '@/pages/Materials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Search, Copy, Check, Move, X } from 'lucide-react';

export default function PartSearchWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchName, setSearchName] = useState('');
  const [results, setResults] = useState<Material[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Dragging state
  const [pos, setPos] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 });

  // Import to Defective Form state
  const [formId, setFormId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    // Load materials
    getCollection('materials').then((data) => {
      setMaterials(data as Material[]);
    });
  }, []);

  useEffect(() => {
    if (!searchName.trim()) {
      setResults([]);
      return;
    }
    const term = searchName.trim().toLowerCase();
    const filtered = materials.filter(m => 
      m.partName?.toLowerCase().includes(term)
    );
    setResults(filtered);
  }, [searchName, materials]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPos({
        x: e.pageX - rel.x,
        y: e.pageY - rel.y
      });
    };
    const onMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, rel]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleImport = async (mat: Material) => {
    if (!formId.trim()) {
      setImportStatus('請輸入不良品單號！');
      return;
    }
    if (!formDate) {
      setImportStatus('請輸入日期！');
      return;
    }

    try {
      const defects = await getCollection('defects') as any[];
      const existing = defects.find(d => d.formId === formId.trim());

      if (existing) {
        await updateDocument('defects', existing.id, {
          materialId: mat.name,
          materialName: mat.partName || '',
          date: formDate
        });
        setImportStatus(`已成功覆蓋單號 ${formId} 的品號！`);
      } else {
        await addDocument('defects', {
          formId: formId.trim(),
          date: formDate,
          materialId: mat.name,
          materialName: mat.partName || '',
          condition: '',
          discoverer: '',
          createdAt: new Date().toISOString()
        });
        setImportStatus(`已建立新單號 ${formId}！`);
      }
      setTimeout(() => setImportStatus(null), 3000);
    } catch (error) {
      console.error(error);
      setImportStatus('匯入失敗！');
    }
  };

  if (!isOpen) {
    return (
      <div 
        className="fixed z-50 flex flex-col items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white shadow-[2px_0_12px_rgba(0,0,0,0.2)] rounded-r-xl cursor-move transition-colors"
        style={{ left: 0, top: pos.y, width: '40px', padding: '12px 4px' }}
        title="開啟品號查詢小工具"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('.no-drag')) return;
          setIsDragging(true);
          setRel({ x: 0, y: e.pageY - pos.y }); // only drag Y when closed? Or let it drag both? If they want it on the edge, we can just track Y, but let's just track both so it doesn't jump.
        }}
        onClick={() => {
          // If we are just clicking (not dragging), open it
          if (!isDragging) setIsOpen(true);
        }}
      >
        <Search className="w-5 h-5 mb-2 no-drag" onClick={() => setIsOpen(true)} />
        <span 
          className="font-bold text-sm tracking-widest no-drag" 
          style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
          onClick={() => setIsOpen(true)}
        >
          品號查詢
        </span>
      </div>
    );
  }

  return (
    <Card 
      className="fixed z-50 w-80 shadow-2xl flex flex-col max-h-[80vh]"
      style={{ left: pos.x, top: pos.y }}
    >
      <CardHeader 
        className="flex flex-row items-center justify-between p-3 bg-indigo-50 border-b cursor-move rounded-t-lg"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('.no-drag')) return;
          setIsDragging(true);
          setRel({ x: e.pageX - pos.x, y: e.pageY - pos.y });
        }}
      >
        <div className="flex items-center gap-2 text-indigo-800">
          <Move className="w-4 h-4" />
          <CardTitle className="text-sm font-bold">品號查詢工具</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 no-drag" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 flex flex-col gap-4 overflow-y-auto no-drag">
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground">物料品名 (忽略大小寫)</label>
          <Input 
            value={searchName} 
            onChange={e => setSearchName(e.target.value)} 
            placeholder="輸入物料品名搜尋..."
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-2 border-t pt-2">
          <label className="text-xs font-bold text-muted-foreground">匯入至不良品單 (選填)</label>
          <div className="grid grid-cols-2 gap-2">
            <Input 
              placeholder="不良品單號" 
              value={formId} 
              onChange={e => setFormId(e.target.value)} 
              className="h-8 text-sm"
            />
            <Input 
              type="date"
              value={formDate} 
              onChange={e => setFormDate(e.target.value)} 
              className="h-8 text-sm"
            />
          </div>
          {importStatus && (
            <div className="text-xs font-bold text-green-600 bg-green-50 p-1 rounded text-center">
              {importStatus}
            </div>
          )}
        </div>

        <div className="border rounded-md min-h-[150px] max-h-[300px] overflow-y-auto bg-slate-50 p-2 space-y-2">
          {results.length === 0 ? (
            <div className="text-xs text-center text-muted-foreground mt-4">無符合的物料品名</div>
          ) : (
            results.map(mat => (
              <div key={mat.id} className="bg-white border rounded p-2 text-xs shadow-sm space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-indigo-700">{mat.partName}</div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      品號: <span className="font-mono text-slate-800">{mat.name}</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 shrink-0" 
                    onClick={() => handleCopy(mat.name)}
                  >
                    {copiedId === mat.name ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full h-6 text-[10px]"
                  onClick={() => handleImport(mat)}
                >
                  匯入此品號與品名
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
