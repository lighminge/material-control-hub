import re

with open('src/pages/Defective.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix the phrases popup
phrase_button = '''<Button variant="ghost" size="sm" className="h-4 px-1 text-[10px]" onClick={() => setShowPhrases(!showPhrases)}>
                          <ListPlus className="w-3 h-3 mr-1" /> 常用內容
                        </Button>'''
new_phrase_button = '''<Button variant="ghost" size="sm" className="h-4 px-1 text-[10px]" onClick={() => setActivePhraseIndex(activePhraseIndex === index ? null : index)}>
                          <ListPlus className="w-3 h-3 mr-1" /> 常用內容
                        </Button>'''
content = content.replace(phrase_button, new_phrase_button)

phrase_popup = '''{showPhrases && ('''
new_phrase_popup = '''{activePhraseIndex === index && ('''
content = content.replace(phrase_popup, new_phrase_popup)

# 2. Add headType select
head_type_col = '''<div className="col-span-2 space-y-1">
                      <Label className="text-xs">物料分類</Label>'''
new_head_type_col = '''<div className="col-span-2 space-y-1">
                      <Label className="text-xs">頭型</Label>
                      <Select value={item.headType} onValueChange={(val) => {
                        const newItems = [...formData.items];
                        newItems[index].headType = val;
                        setFormData({...formData, items: newItems});
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="頭型" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A型">A型</SelectItem>
                          <SelectItem value="B型">B型</SelectItem>
                          <SelectItem value="其他">其他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">物料分類</Label>'''
content = content.replace(head_type_col, new_head_type_col)

# Fix col spans to fit headType (added col-span-2, so we need to reduce something else. 
# Currently: category(2) + id(3) + name(4) + qty(3) = 12. 
# We need to make room. 
# New: headType(2) + category(2) + id(3) + name(3) + qty(2) = 12.
col_id = '''<div className="col-span-3 space-y-1">
                      <Label className="text-xs">物料品號</Label>'''
col_name = '''<div className="col-span-4 space-y-1">
                      <Label className="text-xs">物料品名</Label>'''
col_qty = '''<div className="col-span-3 space-y-1">
                      <Label className="text-xs">不良品數量</Label>'''

content = content.replace(col_name, col_name.replace("col-span-4", "col-span-3"))
content = content.replace(col_qty, col_qty.replace("col-span-3", "col-span-2"))

# 3. Add total items count in modal
item_title = '''<h3 className="font-bold text-lg">不良品項目</h3>'''
new_item_title = '''<h3 className="font-bold text-lg">不良品項目 <span className="text-sm font-normal text-muted-foreground">(共 {formData.items.length} 項)</span></h3>'''
content = content.replace(item_title, new_item_title)

# 4. Fix table to show forms
table_start = content.find('<Table>')
table_end = content.find('</Table>') + len('</Table>')
new_table = '''<Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">操作</TableHead>
                <TableHead className="w-16">序號</TableHead>
                <TableHead className="w-32">單號</TableHead>
                <TableHead className="w-32">日期</TableHead>
                <TableHead className="w-24">發現人員</TableHead>
                <TableHead className="w-24 text-center">項目總數</TableHead>
                <TableHead>不良品內容</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">載入中...</TableCell></TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24">尚無不良品單記錄</TableCell></TableRow>
              ) : (
                paginatedData.map((form, index) => {
                  return (
                    <TableRow key={form.formId}>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(form)}>編輯</Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmFormId(form.formId)}>刪除</Button>
                        </div>
                      </TableCell>
                      <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                      <TableCell className="font-bold">{form.formId}</TableCell>
                      <TableCell>{form.date}</TableCell>
                      <TableCell>{form.discoverer}</TableCell>
                      <TableCell className="text-center font-bold text-red-600">{form.items.length}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 py-1">
                          {form.items.map((item, idx) => (
                            <div key={idx} className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded shadow-sm">{item.materialId}</span>
                              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded shadow-sm">{item.materialName}</span>
                              {item.headType && (
                                <span className={px-1.5 py-0.5 text-[10px] rounded font-bold border }>
                                  {item.headType}
                                </span>
                              )}
                              <span className="text-xs text-red-600 font-bold bg-red-50 px-1.5 py-0.5 border border-red-100 rounded">缺 {item.quantity || 0} PCS</span>
                              {item.condition && <span className="text-xs text-muted-foreground">({item.condition})</span>}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>'''

content = content[:table_start] + new_table + content[table_end:]

# Replace setDeleteConfirmItem(defect) with setDeleteConfirmFormId(defect.formId) if it exists.
# We already did it in the new table. Wait, we also need to fix the delete dialog logic!
dialog_delete = '''<Button variant="destructive" onClick={() => { if(deleteConfirmItem?.id) handleDelete(deleteConfirmItem.id); }}>確認刪除</Button>'''
new_dialog_delete = '''<Button variant="destructive" onClick={() => { if(deleteConfirmFormId) handleDelete(deleteConfirmFormId); }}>確認刪除</Button>'''
content = content.replace(dialog_delete, new_dialog_delete)

dialog_delete_text = '''確定要刪除不良品單號 [{deleteConfirmItem?.formId}] 嗎？此動作無法復原。'''
new_dialog_delete_text = '''確定要刪除不良品單號 [{deleteConfirmFormId}] 嗎？此動作無法復原。'''
content = content.replace(dialog_delete_text, new_dialog_delete_text)

dialog_open = '''<Dialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && setDeleteConfirmItem(null)}>'''
new_dialog_open = '''<Dialog open={!!deleteConfirmFormId} onOpenChange={(open) => !open && setDeleteConfirmFormId(null)}>'''
content = content.replace(dialog_open, new_dialog_open)

dialog_cancel = '''<Button variant="outline" onClick={() => setDeleteConfirmItem(null)}>取消</Button>'''
new_dialog_cancel = '''<Button variant="outline" onClick={() => setDeleteConfirmFormId(null)}>取消</Button>'''
content = content.replace(dialog_cancel, new_dialog_cancel)

filtered_defects_count = '''符合條件共 {filteredDefects.length} 筆資料'''
new_filtered_defects_count = '''符合條件共 {filteredForms.length} 筆資料'''
content = content.replace(filtered_defects_count, new_filtered_defects_count)

with open('src/pages/Defective.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

