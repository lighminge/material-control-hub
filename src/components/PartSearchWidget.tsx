import { useState, useEffect, useRef } from 'react';
import { getCollection, addDocument, getDocument, setDocumentWithId } from '@/lib/firebase/api';
import type { Material } from '@/pages/Materials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Search, Copy, Check, Move, X, ListPlus, Trash2, Pencil } from 'lucide-react';

export default function PartSearchWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
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
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState<number | ''>('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  
  const [condition, setCondition] = useState('');
  const [phrases, setPhrases] = useState<string[]>([]);
  const [showPhrases, setShowPhrases] = useState(false);
  const [newPhrase, setNewPhrase] = useState('');
  const [editingPhraseIndex, setEditingPhraseIndex] = useState<number | null>(null);
  const [editPhraseText, setEditPhraseText] = useState('');
  const [existingDefects, setExistingDefects] = useState<any[]>([]);

  const savePhrases = async (newPhrases: string[]) => {
    setPhrases(newPhrases);
    await setDocumentWithId('settings', 'defectivePhrases', { phrases: newPhrases });
  };

  const addPhrase = () => {
    if (newPhrase.trim() && !phrases.includes(newPhrase.trim())) {
      savePhrases([...phrases, newPhrase.trim()]);
      setNewPhrase('');
    }
  };

  const handleSaveEditPhrase = async () => {
    if (editingPhraseIndex === null || !editPhraseText.trim()) return;
    if (phrases[editingPhraseIndex] === editPhraseText.trim()) {
      setEditingPhraseIndex(null);
      return;
    }
    const updated = [...phrases];
    updated[editingPhraseIndex] = editPhraseText.trim();
    await savePhrases(updated);
    setEditingPhraseIndex(null);
  };

  const handleDeletePhrase = async (index: number) => {
    if (confirm('確定要刪除這筆常用內容嗎？')) {
      const updated = phrases.filter((_, i) => i !== index);
      await savePhrases(updated);
    }
  };

  useEffect(() => {
    // Load materials
    getCollection('materials').then((data) => {
      setMaterials(data as Material[]);
    });
    getDocument('settings', 'defectivePhrases').then(doc => {
      if (doc && (doc as any).phrases) setPhrases((doc as any).phrases);
    });
  }, []);

  useEffect(() => {
    getCollection('defects').then(d => setExistingDefects(d as any[]));
  }, [isOpen, importStatus]);

  useEffect(() => {
    const trimmed = formId.trim();
    if (trimmed && existingDefects.length > 0) {
      const matched = existingDefects.find(d => d.formId === trimmed);
      if (matched && matched.date) {
        setFormDate(matched.date);
      }
    }
  }, [formId, existingDefects]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && widgetRef.current && !widgetRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!searchName.trim()) {
      setResults([]);
      return;
    }
    const term = searchName.trim().toLowerCase();
    const filtered = materials.filter(m => 
      m.partName?.toLowerCase().includes(term) || m.name.toLowerCase().includes(term)
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
    if (quantity === '' || quantity <= 0) {
      setImportStatus('請輸入不良品數量！');
      return;
    }


    try {
      const defects = await getCollection('defects') as any[];
      const existing = defects.find(d => d.formId === formId.trim());

      if (existing) {
        await addDocument('defects', {
          formId: existing.formId,
          date: existing.date,
          discoverer: existing.discoverer,
          materialId: mat.name,
          materialName: mat.partName || '',
          headType: mat.headType || '',
          category: mat.category || '未分類',
          condition: condition,
          quantity: quantity,
          workOrder: '',
          workOrderQuantity: 0,
          createdAt: new Date().toISOString()
        });
        setImportStatus(`已成功新增項目至單號 ${formId}！`);
      } else {
        await addDocument('defects', {
          formId: formId.trim(),
          date: formDate,
          materialId: mat.name,
          materialName: mat.partName || '',
          headType: mat.headType || '',
          category: mat.category || '未分類',
          condition: condition,
          quantity: quantity,
          workOrder: '',
          workOrderQuantity: 0,
          discoverer: '',
          createdAt: new Date().toISOString()
        });
        setImportStatus(`已建立新單號 ${formId}！`);
      }
      
      window.dispatchEvent(new Event('defectsUpdated'));
      setTimeout(() => setImportStatus(null), 3000);
    } catch (error) {
      console.error(error);
      setImportStatus('匯入失敗！');
    }
  };

  const matchedDefects = existingDefects.filter(d => d.formId === formId.trim());

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
      ref={widgetRef}
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
              className="h-8 text-sm disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100"
              disabled={matchedDefects.length > 0}
              onClick={(e: any) => { if (matchedDefects.length === 0) e.target.showPicker?.(); }}
            />
            <div className="col-span-2">
              <Input 
                type="number"
                placeholder="不良品數量"
                min="0"
                value={quantity} 
                onChange={e => setQuantity(e.target.value ? Number(e.target.value) : '')} 
                className="h-8 text-sm"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1 relative">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-muted-foreground">不良情況</label>
                <Button variant="ghost" size="sm" className="h-4 px-1 text-[10px]" onClick={() => setShowPhrases(!showPhrases)}>
                  <ListPlus className="w-3 h-3 mr-1" /> 常用內容
                </Button>
              </div>
              <Input 
                value={condition} 
                onChange={e => setCondition(e.target.value)} 
                className="h-8 text-sm"
              />
              {showPhrases && (
                <div className="absolute right-0 top-10 z-10 w-64 bg-white border rounded-md shadow-lg p-2 max-h-48 overflow-y-auto">
                  <div className="flex gap-2 mb-2">
                    <Input value={newPhrase} onChange={e => setNewPhrase(e.target.value)} placeholder="新增常用內容..." className="h-7 text-xs" />
                    <Button size="sm" onClick={addPhrase} className="h-7 px-2 shrink-0">新增</Button>
                  </div>
                  <div className="space-y-1">
                    {phrases.map((p, i) => (
                      <div key={i} className="flex justify-between items-center bg-slate-50 p-1 rounded group">
                        {editingPhraseIndex === i ? (
                          <Input 
                            value={editPhraseText} 
                            onChange={e => setEditPhraseText(e.target.value)} 
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEditPhrase(); }} 
                            autoFocus
                            className="h-7 text-xs flex-1"
                          />
                        ) : (
                          <span className="text-xs cursor-pointer flex-1" onClick={() => {
                            setCondition(condition ? condition + '，' + p : p);
                            setShowPhrases(false);
                          }}>{i + 1}. {p}</span>
                        )}
                        <div className="flex gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {editingPhraseIndex === i ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-green-600" onClick={handleSaveEditPhrase}>
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => setEditingPhraseIndex(null)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-blue-600" onClick={(e) => { e.stopPropagation(); setEditPhraseText(p); setEditingPhraseIndex(i); }}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-red-600" onClick={(e) => { e.stopPropagation(); handleDeletePhrase(i); }}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {matchedDefects.length > 0 && (
              <div className="text-[10px] text-blue-600 font-bold bg-blue-50 p-1 rounded col-span-2">
                系統已存在單號 {formId} ({matchedDefects.length} 筆項目)
              </div>
            )}
          </div>
          
          {importStatus && (
            <div className="text-xs font-bold text-green-600 bg-green-50 p-1 rounded text-center">
              {importStatus}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t pt-2">
          <label className="text-xs font-bold text-muted-foreground">物料品名 (忽略大小寫)</label>
          <Input 
            value={searchName} 
            onChange={e => setSearchName(e.target.value)} 
            placeholder="輸入物料品名搜尋..."
            className="h-8 text-sm"
          />
        </div>

        <div className="border rounded-md min-h-[150px] max-h-[300px] overflow-y-auto bg-slate-50 p-2 space-y-2">
          {results.length > 0 && (
            <div className="text-[10px] text-muted-foreground text-right">總共 {results.length} 筆資料</div>
          )}
          {results.length === 0 ? (
            <div className="text-xs text-center text-muted-foreground mt-4">無符合的物料</div>
          ) : (
            results.map((mat, index) => {
              const existingCount = matchedDefects.filter(d => d.materialId === mat.name && (d.headType || '') === (mat.headType || '')).length;
              const isExisting = existingCount > 0;
              return (
                <div key={mat.id} className={`border rounded p-2 text-xs shadow-sm space-y-2 relative ${isExisting ? 'bg-amber-50 border-amber-300' : 'bg-white'}`}>
                  <div className={`absolute top-2 left-2 text-[10px] font-mono ${isExisting ? 'text-amber-500' : 'text-slate-400'}`}>{index + 1}.</div>
                  <div className="flex justify-between items-start pl-4">
                    <div>
                      <div className={`font-bold ${isExisting ? 'text-amber-800' : 'text-indigo-700'}`}>
                        {mat.partName} 
                        {mat.headType && (
                          <span className={`ml-2 text-[10px] px-1 py-0.5 rounded font-normal border ${mat.headType === 'A型' ? 'bg-purple-100 text-purple-700 border-purple-200' : mat.headType === 'B型' ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {mat.headType}
                          </span>
                        )}
                        {isExisting && (
                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-200 text-amber-800 border border-amber-300">
                            已存在此單 ({existingCount}筆)
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        品號: <span className="font-mono text-slate-800">{mat.name}</span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`h-6 px-2 shrink-0 ${isExisting ? 'hover:bg-amber-200 text-amber-700' : ''}`} 
                      onClick={() => handleCopy(mat.name)}
                    >
                      {copiedId === mat.name ? <Check className={`w-3 h-3 ${isExisting ? 'text-amber-600' : 'text-green-500'}`} /> : <Copy className="w-3 h-3" />}
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
            );
          })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
