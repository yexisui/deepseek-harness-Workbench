# 工作簿生成参数

在工具列出的能力中选择“Excel 生成”的 `generate` 动作（动作标识为 `pack:org.workbench.excel:writer:generate`）。`capabilityId` 使用当前工具实际列出的ID，不猜测。`capability_action.input` 为以下对象经 JSON 编码后的字符串：

```json
{
  "fileName": "示例清单.xlsx",
  "sheets": [{
    "name": "清单",
    "rows": [["项目", "数量", "合计"], ["示例A", 2, null], ["示例B", 3, null], ["总计", null, {"formula":"SUM(C2:C3)", "result":5}]],
    "formulas": [{"range":"C2:C3", "formula":"B{row}"}],
    "formats": [
      {"range":"A1:C4", "font":{"name":"等线", "size":11}, "alignment":{"vertical":"middle", "wrapText":true}},
      {"range":"A1:C1", "font":{"bold":true}, "fill":"#E6EDF5"},
      {"range":"B2:C4", "numFmt":"0.00"}
    ],
    "columnWidths":[28, 12, 12],
    "rowHeights":[{"from":1, "height":25}],
    "freezeRows":1
  }]
}
```

上例只是参数演示，业务数值、列名、字体配色不是模块固定规则。

- `fileName`：不含路径的 `.xlsx` 名称。每次生成新任务，保留此前结果。
- `sheets`：按提供顺序创建工作表。名称唯一（不区分大小写），最多31字符。
- `rows`：从A1开始的二维数组，支持文本、数字、布尔、null（留空），或 `{ "formula":"SUM(B2:B5)", "result":10 }`。`result` 可省略，表示打开后重算；不要编造缓存值。
- `formulas`：可选，`range` 指定矩形区域，`formula` 原样写入各格，`{row}` 替换为当前行号。其他相对引用不会自动平移；同一列逐行计算建议用 `{row}`。目标单元格必须留空，避免覆盖业务数据。公式可带或不带开头等号。
- `merges`：可选，如 `["A1:C1"]`。除左上格外须留空，合并不能重叠。
- `formats`：可选，按顺序对指定区域叠加格式；后项同名格式属性覆盖前项。`font` 支持 name/size/bold/italic/color；`fill` 为颜色；`alignment` 支持 horizontal(left/center/right)、vertical(top/middle/bottom)、wrapText；`border` 为 `{ "style":"thin", "color":"#808080" }`，应用四边；`numFmt` 为 Excel 格式字符串。
- `columnWidths`：可选，按A/B/C顺序提供列宽，null保留默认。
- `rowHeights`：可选，`{from:3,to:15,height:42}` 指定范围；省略to只改一行。
- `freezeRows`：可选，冻结前N行。`autoFilter`：可选，筛选区域如 `A1:C10`。

所有颜色为 `#RRGGBB`；不支持任意路径、代码、宏、外部公式或网络地址。没有描述的功能不得通过添加自定义字段猜测。当前上限为20工作表、单表10000行/256列/20000单元格、输入256KiB、生成文件350KB。超限时按业务边界拆分，不丢数据。

跨表公式为 `='工作表名'!A1`。标题有单引号时将其重复转义。所有引用工作表必须存在。如果13条数据从第3行开始，则最后数据行为15、合计行为16、下一汇总行为17；实际行号始终由本次数据数量推导，不照搬示例。

工具返回 `documentId`、`fileName`、`downloadUrl`、`sheets`、`formulaCount` 和 `recalculation`。只返回实际成功结果的下载链接；`formulaCount` 是已写入公式数量，不代表公式已全部计算验证。
