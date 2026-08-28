import re

with open('src/pages/Statistics.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace return block
return_block = '''  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center bg-muted/30 p-4 rounded-xl border border-border/50 gap-6">
        <div className="flex items-center gap-3">
          <PieChart className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-primary">統計作業</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">'''

new_return_block = '''  return (
    <Tabs defaultValue="material" className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center bg-muted/30 p-4 rounded-xl border border-border/50 gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <PieChart className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-primary">統計作業</h1>
          </div>
          <TabsList className="self-start">
            <TabsTrigger value="material">物料管制統計</TabsTrigger>
            <TabsTrigger value="defective">不良品統計</TabsTrigger>
          </TabsList>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 ml-auto">'''

content = content.replace(return_block, new_return_block)

# We need to wrap the material content in TabsContent
old_card = '''<Card className="mb-6 shadow-sm border-t-4 border-t-blue-500">'''
new_card = '''<TabsContent value="material" className="space-y-6">\n      <Card className="mb-6 shadow-sm border-t-4 border-t-blue-500">'''
content = content.replace(old_card, new_card)

# And add the defective TabsContent at the very end
old_end = '''    </div>
  );
}'''
new_end = '''      </TabsContent>
      
      <TabsContent value="defective" className="space-y-6">
        <Card className="shadow-sm border-t-4 border-t-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold">查詢條件設定</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>建單日期(起)</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} onClick={(e: any) => e.target.showPicker?.()} disabled={useYearFilter} />
            </div>
            <div className="space-y-2">
              <Label>建單日期(迄)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} onClick={(e: any) => e.target.showPicker?.()} disabled={useYearFilter} />
            </div>
          </CardContent>
        </Card>
        
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">符合條件的不良品單數量</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">{defectiveStats.formsCount}</div>
              <p className="text-xs text-muted-foreground mt-2">表單總數</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">符合條件的不良品項目數量</CardTitle>
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-destructive">{defectiveStats.itemsCount}</div>
              <p className="text-xs text-muted-foreground mt-2">各項不良物料加總</p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}'''
content = content.replace(old_end, new_end)

with open('src/pages/Statistics.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
