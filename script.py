import re

with open('src/pages/Defective.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to replace the content inside <DialogContent className="max-w-xl"...> up to the Save/Cancel buttons.
dialog_start = content.find('<DialogContent className="max-w-xl" onPointerDownOutside={(e) => e.preventDefault()}>')

# Find the end of the form elements (the Save/Cancel buttons are at the end of the form)
dialog_buttons_start = content.find('<div className="flex justify-end gap-2 mt-4">', dialog_start)

replacement = '''<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{editingId ? '編輯不良品單' : '新增不良品單'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-4 py-4 border-b">
              <div className="space-y-2">
                <Label>不良品單號</Label>
                <Input value={formData.formId} disabled={!!editingId} onChange={e => setFormData({...formData, formId: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>日期</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} onClick={(e: any) => e.target.showPicker?.()} />
              </div>
              <div className="space-y-2">
                <Label>發現人員</Label>
                <Select value={formData.discoverer} onValueChange={val => setFormData({...formData, discoverer: val})}>
                  <SelectTrigger><SelectValue placeholder="選擇發現人員" /></SelectTrigger>
                  <SelectContent>
                    {staffList.filter(s => s.permissions?.includes('移印') || s.permissions?.includes('品檢')).map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-4 py-2">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">不良品項目</h3>
                <Button variant="outline" size="sm" onClick={() => setFormData({...formData, items: [...formData.items, { materialId: '', materialName: '', condition: '', quantity: '', workOrder: '', workOrderQuantity: '', category: '' }]})}>
                  <Plus className="w-4 h-4 mr-1" /> 新增項目
                </Button>
              </div>
              
              {formData.items.map((item, index) => (
                <Card key={index} className="relative">
                  {formData.items.length > 1 && (
                    <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full z-10" onClick={() => {
                      const newItems = [...formData.items];
                      newItems.splice(index, 1);
                      setFormData({...formData, items: newItems});
                    }}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                  <CardContent className="p-4 grid grid-cols-12 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">物料分類</Label>
                      <Select value={item.category} onValueChange={(val) => {
                        const newItems = [...formData.items];
                        newItems[index].category = val;
                        newItems[index].materialId = '';
                        newItems[index].materialName = '';
                        setFormData({...formData, items: newItems});
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="分類" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="未分類">未分類</SelectItem>
                          <SelectItem value="TKW">TKW</SelectItem>
                          <SelectItem value="夾鉗">夾鉗</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">物料品號</Label>
                      <Input 
                        list={mat-id-}
                        value={item.materialId}
                        className="h-8 text-xs"
                        onChange={e => {
                          const val = e.target.value;
                          const mat = materials.find(m => {
                            const compositeId = ${m.name};
                            return compositeId === val || m.name === val;
                          });
                          const newItems = [...formData.items];
                          newItems[index].materialId = mat ? mat.name : val;
                          newItems[index].materialName = mat ? (mat.partName || mat.name) : newItems[index].materialName;
                          setFormData({...formData, items: newItems});
                        }}
                        placeholder="輸入/選擇品號"
                      />
                      <datalist id={mat-id-}>
                        {materials.filter(m => !item.category || m.category === item.category).map(m => (
                          <option key={m.id} value={${m.name}} />
                        ))}
                      </datalist>
                    </div>
                    
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs">物料品名</Label>
                      <Input 
                        list={mat-name-}
                        value={item.materialName}
                        className="h-8 text-xs"
                        onChange={e => {
                          const val = e.target.value;
                          const mat = materials.find(m => {
                            const compositeName = ${m.partName || m.name};
                            return compositeName === val || m.partName === val || m.name === val;
                          });
                          const newItems = [...formData.items];
                          newItems[index].materialName = mat ? (mat.partName || mat.name) : val;
                          newItems[index].materialId = mat ? mat.name : newItems[index].materialId;
                          setFormData({...formData, items: newItems});
                        }}
                        placeholder="輸入/選擇品名"
                      />
                      <datalist id={mat-name-}>
                        {materials.filter(m => !item.category || m.category === item.category).map(m => (
                          <option key={m.id} value={${m.partName || m.name}} />
                        ))}
                      </datalist>
                    </div>
                    
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">不良品數量</Label>
                      <Input type="number" min="0" value={item.quantity} onChange={e => {
                        const newItems = [...formData.items];
                        newItems[index].quantity = e.target.value ? Number(e.target.value) : '';
                        setFormData({...formData, items: newItems});
                      }} className="h-8 text-xs" placeholder="數量" />
                    </div>
                    
                    <div className="col-span-6 space-y-1 relative">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs">不良情況</Label>
                        <Button variant="ghost" size="sm" className="h-4 px-1 text-[10px]" onClick={() => setShowPhrases(!showPhrases)}>
                          <ListPlus className="w-3 h-3 mr-1" /> 常用內容
                        </Button>
                      </div>
                      <Input value={item.condition} onChange={e => {
                        const newItems = [...formData.items];
                        newItems[index].condition = e.target.value;
                        setFormData({...formData, items: newItems});
                      }} className="h-8 text-xs" placeholder="描述不良情況" />
                      
                      {showPhrases && (
                        <div className="absolute right-0 top-12 z-20 w-64 bg-white border rounded-md shadow-lg p-2">
                          <div className="flex gap-2 mb-2">
                            <Input value={newPhrase} onChange={e => setNewPhrase(e.target.value)} placeholder="新增常用內容..." className="h-7 text-xs" />
                            <Button size="sm" onClick={addPhrase} className="h-7 px-2">新增</Button>
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {phrases.map((p, i) => (
                              <div key={i} className="flex justify-between items-center bg-slate-50 p-1 rounded group">
                                {editingPhraseIndex === i ? (
                                  <Input 
                                    value={editPhraseText} 
                                    onChange={e => setEditPhraseText(e.target.value)} 
                                    onKeyDown={e => { if (e.key === "Enter") handleSaveEditPhrase(); }} 
                                    autoFocus
                                    className="h-7 text-xs flex-1"
                                  />
                                ) : (
                                  <span className="text-xs cursor-pointer flex-1" onClick={() => {
                                    const newItems = [...formData.items];
                                    newItems[index].condition = newItems[index].condition ? newItems[index].condition + '，' + p : p;
                                    setFormData({...formData, items: newItems});
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
                                      <Button variant="ghost" size="icon" className="h-5 w-5 text-blue-600" onClick={() => { setEditingPhraseIndex(i); setEditPhraseText(p); }}>
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500" onClick={() => removePhrase(p)}>
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
                    
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">製令編號</Label>
                      <Input value={item.workOrder} onChange={e => {
                        const newItems = [...formData.items];
                        newItems[index].workOrder = e.target.value;
                        setFormData({...formData, items: newItems});
                      }} className="h-8 text-xs" placeholder="製令編號" />
                    </div>
                    
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs">製令數量</Label>
                      <Input type="number" min="0" value={item.workOrderQuantity} onChange={e => {
                        const newItems = [...formData.items];
                        newItems[index].workOrderQuantity = e.target.value ? Number(e.target.value) : '';
                        setFormData({...formData, items: newItems});
                      }} className="h-8 text-xs" placeholder="製令數量" />
                    </div>
                    
                  </CardContent>
                </Card>
              ))}
            </div>
            
'''

new_content = content[:dialog_start] + replacement + content[dialog_buttons_start:]

with open('src/pages/Defective.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
