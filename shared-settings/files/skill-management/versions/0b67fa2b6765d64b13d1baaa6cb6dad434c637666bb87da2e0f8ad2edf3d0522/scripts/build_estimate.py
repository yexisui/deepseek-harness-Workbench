#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_estimate.py — 工作量估算表生成脚本（workload-estimator skill）

以 assets/工作量估算表-模板.xlsx 为骨架，按 spec JSON 生成与模板结构一致的
工作量估算表：
  - 保留全部公式：需求/设计/测试/管理人天 = 比例权重 × 编码人天（编码人天是唯一手填列）
  - 行合计 K = SUM(F:J)，底部「小计：人天」= SUM， 「小计：人月」= 人天/21.75
  - 汇总表：AI部分一行（费用项 / 数量（人月）引用明细表末行人月 / 备注），末行「合计」SUM
  - 小计/汇总公式范围按实际数据行数重算（模板自身范围已过期）
  - 公共部分（域登录与安全/系统日志管理/系统安全）**默认不追加**（include_common 缺省 false），
    仅当 spec 显式设 "include_common": true 时才追加到 AI部分 明细表末尾，
    人天数见 assets/公共部分.json，可用 spec 的 common_coding_days 覆盖（每项限制 0.5~3）

依赖: python3 + openpyxl   （缺失时: pip install openpyxl）

用法:
    python build_estimate.py --spec spec.json -o 工作量估算表-XX项目.xlsx
    python build_estimate.py --spec spec.json -o out.xlsx --template 自定义模板.xlsx

spec JSON 结构示例（输出 工作量汇总表 + AI部分 两张表）:
{
  "project_name": "阳江AI审查项目",
  "modules": [
    {
      "name": "AI审查引擎核心",
      "items": [
        {"func": "审批意见自动生成", "desc": "开发AI审批意见生成算法…", "coding_days": 12, "remark": ""}
      ]
    }
  ]
}
兼容旧格式 "parts": [{"name": ..., "modules": [...]}]——多个部分会合并为一张 AI部分 明细表。
"""

import argparse
import json
import re
import sys
from copy import copy
from pathlib import Path

import openpyxl

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_TEMPLATE = SCRIPT_DIR.parent / "assets" / "工作量估算表-模板.xlsx"
COMMON_JSON = SCRIPT_DIR.parent / "assets" / "公共部分.json"
DAYS_PER_MONTH = 21.75
DEFAULT_PART_NAME = "AI部分"   # 只输出一张明细表，所有模块统一合并到「AI部分」
NOTE_TEXT = "1人月按照21.75人天计算；"
COMMON_MIN, COMMON_MAX = 0.5, 3.0   # 公共部分每项编码人天允许范围
COLUMNS = "ABCDEFGHIJKL"          # 明细表全部列
TOTAL_COLUMNS = "FGHIJK"          # 需要小计/人月公式的列


def load_common_modules():
    """读取公共部分模块（域登录与安全/系统日志管理/系统安全），每次生成自动保留。"""
    if not COMMON_JSON.exists():
        return []
    data = json.loads(COMMON_JSON.read_text(encoding="utf-8"))
    return data.get("modules", [])


def clamp_common_days(v, func=""):
    """把公共部分编码人天限制在 0.5~3 之内（业务规则）。"""
    try:
        v = float(v)
    except (TypeError, ValueError):
        fail(f"公共部分「{func}」: 编码人天必须是数字，实际 {v!r}")
    if v < COMMON_MIN or v > COMMON_MAX:
        print(f"[提示] 公共部分「{func}」人天数 {v:g} 超出 {COMMON_MIN}~{COMMON_MAX}，已按范围边界调整")
        return max(COMMON_MIN, min(COMMON_MAX, v))
    return v


def append_common_modules(parts, spec):
    """把公共部分模块追加到第一个明细部分末尾（与模板惯例一致）。

    - spec 显式设 "include_common": true 才追加，缺省 false（默认不包含公共部分）
    - 若 parts[0] 已包含同名模块（如 AI 已手动填写），自动跳过，避免重复
    - spec["common_coding_days"] 可按功能名覆盖人天数，如 {"域登录验证": 6}
    - 公共部分每项编码人天必须在 0.5~3 之间（自动限制）
    """
    if not spec.get("include_common", False) or not parts:
        return
    common_modules = load_common_modules()
    if not common_modules:
        return
    existing = {m["name"] for m in parts[0].get("modules", [])}
    overrides = spec.get("common_coding_days", {}) or {}
    for cm in common_modules:
        if cm["name"] in existing:
            continue
        items = []
        for it in cm.get("items", []):
            it = dict(it)
            if it.get("func") in overrides:
                it["coding_days"] = overrides[it["func"]]
            it["coding_days"] = clamp_common_days(it["coding_days"], it.get("func", ""))
            items.append(it)
        parts[0].setdefault("modules", []).append({"name": cm["name"], "items": items})


def copy_style(src, dst):
    """把 src 单元格的样式原样复制到 dst（字体/边框/填充/对齐/数字格式）。"""
    dst.font = copy(src.font)
    dst.border = copy(src.border)
    dst.fill = copy(src.fill)
    dst.alignment = copy(src.alignment)
    dst.number_format = src.number_format
    dst.protection = copy(src.protection)


def fail(msg):
    print(f"[错误] {msg}", file=sys.stderr)
    sys.exit(1)


def sanitize_sheet_title(name):
    cleaned = re.sub(r"[\\/?*\[\]:]", "_", str(name)).strip()
    if not cleaned:
        fail("部分名称不能为空")
    if len(cleaned) > 31:
        cleaned = cleaned[:31]
    return cleaned


def merge_range(ws, rng):
    """合并单元格；单格范围跳过（openpyxl/Excel 不喜欢单格合并）。"""
    a, _, b = rng.partition(":")
    if a != b:
        ws.merge_cells(rng)


def est_row_height(desc):
    """按说明文字长度估算数据行高，保证换行文字完整显示（模板区间 28~41）。"""
    desc = str(desc or "")
    # E 列宽约 39 字符，中文按宽字符计，每行约容 19 字
    lines = max(1, -(-len(desc) // 19)) if desc else 1
    return max(28, min(46, 15 * lines + 16))


def trim_rows(ws, keep):
    """清空 keep 行之后的所有内容（合并、单元格、行高）。

    不用 ws.delete_rows：openpyxl 的 delete_rows 不会移除位于删除区内的
    合并单元格，残留合并会导致 max_row 虚高、表格多出空行。
    """
    for rng in list(ws.merged_cells.ranges):
        if rng.min_row > keep:
            ws.unmerge_cells(str(rng))
    for key in list(ws._cells):
        if key[0] > keep:
            del ws._cells[key]
    for key in list(ws.row_dimensions):
        if key > keep:
            del ws.row_dimensions[key]


def build_detail_sheet(ws, title, project_name, modules, start_no):
    """把一张明细 sheet 重建成指定模块/功能项的内容，公式与样式沿用模板。"""
    # ---- 先截取样式供体（删除数据行之前） ----
    days_row = ws.max_row - 1          # 模板「小计：人天」行
    month_row = ws.max_row             # 模板「小计：人月」行
    data_donor = {c: ws[f"{c}3"] for c in COLUMNS}
    days_donor = {c: ws[f"{c}{days_row}"] for c in COLUMNS}
    month_donor = {c: ws[f"{c}{month_row}"] for c in COLUMNS}
    h_data = ws.row_dimensions[3].height
    h_days = ws.row_dimensions[days_row].height
    h_month = ws.row_dimensions[month_row].height

    trim_rows(ws, 2)

    # ---- 展平功能项 ----
    rows_meta = []  # (模块, 功能, 说明, 编码人天, 备注)
    for m in modules:
        for it in m.get("items", []):
            rows_meta.append(
                (m["name"], it.get("func", ""), it.get("desc", ""),
                 it.get("coding_days"), it.get("remark", "")))
    if not rows_meta:
        fail(f"部分「{title}」没有任何功能项")

    # ---- 写数据行 ----
    row = 3
    module_start = 3
    func_start = 3
    prev_module = None
    prev_func = None
    for idx, (mod, func, desc, cd, remark) in enumerate(rows_meta):
        r = row
        ws.cell(r, 1, start_no + idx)                       # 序号
        ws.cell(r, 2, project_name)                         # 项目名（整列合并）
        ws.cell(r, 3, mod)                                  # 模块（合并）
        ws.cell(r, 4, func)                                 # 功能（合并）
        ws.cell(r, 5, desc)                                 # 说明
        ws.cell(r, 6, f"=$F$2*H{r}/$H$2")                   # 需求人天（公式）
        ws.cell(r, 7, f"=$G$2*H{r}/$H$2")                   # 设计人天（公式）
        ws.cell(r, 8, cd)                                   # 编码人天（唯一手填）
        ws.cell(r, 9, f"=$I$2*H{r}/$H$2")                   # 测试人天（公式）
        ws.cell(r, 10, f"=$J$2*H{r}/$H$2")                  # 管理人天（公式）
        ws.cell(r, 11, f"=SUM(F{r}:J{r})")                  # 合计（公式）
        ws.cell(r, 12, remark)                              # 备注
        for c in COLUMNS:
            copy_style(data_donor[c], ws[f"{c}{r}"])
        ws.row_dimensions[r].height = est_row_height(desc)
        # 合并跟踪：C 按模块、D 按连续同模块同功能
        if mod != prev_module:
            if prev_module is not None:
                merge_range(ws, f"C{module_start}:C{r - 1}")
            module_start = r
        if (mod, func) != (prev_module, prev_func):
            if prev_module is not None:
                merge_range(ws, f"D{func_start}:D{r - 1}")
            func_start = r
        prev_module, prev_func = mod, func
        row += 1

    last_item = row - 1
    merge_range(ws, f"C{module_start}:C{last_item}")
    merge_range(ws, f"D{func_start}:D{last_item}")
    merge_range(ws, f"B3:B{last_item}")

    # ---- 小计行 ----
    r1 = last_item + 1          # 小计：人天
    r2 = r1 + 1                 # 小计：人月
    next_no = start_no + len(rows_meta)
    ws.cell(r1, 1, next_no)
    ws.cell(r1, 2, "小计：人天")
    ws.cell(r2, 1, next_no)
    ws.cell(r2, 2, "小计：人月")
    for c in TOTAL_COLUMNS:
        ci = COLUMNS.index(c) + 1
        ws.cell(r1, ci, f"=SUM({c}3:{c}{last_item})")
        ws.cell(r2, ci, f"={c}{r1}/{DAYS_PER_MONTH}")
        copy_style(days_donor[c], ws[f"{c}{r1}"])
        copy_style(month_donor[c], ws[f"{c}{r2}"])
        ws[f"{c}{r2}"].number_format = "0.00"   # 人月小计统一显示两位小数
    for c in "AB":
        copy_style(days_donor[c], ws[f"{c}{r1}"])
        copy_style(month_donor[c], ws[f"{c}{r2}"])
    merge_range(ws, f"B{r1}:E{r1}")
    merge_range(ws, f"B{r2}:E{r2}")
    ws.row_dimensions[r1].height = h_days
    ws.row_dimensions[r2].height = h_month

    ws.title = title
    return r2                   # 返回「小计：人月」所在行（供汇总表引用）


def build_summary(ws, project_name, parts, titles, last_rows):
    """重建汇总表：项目名 + 每部分一行（费用项/数量（人月）/备注），**无合计行**。

    样式与模板完全一致（浅蓝 #CCFFFF 表头、宋体、3 行 × 3 列基础结构）：
      - 第 1 行：合并标题 = 项目名（不加后缀）
      - 第 2 行：表头 费用项 / 数量（人月）/ 备注
      - 第 3 行：费用项 = 部分名（不拼接项目名前缀）、数量（人月）引用明细表
        「小计：人月」行 K 列（数字格式 0.00_）、备注 = 1人月按21.75人天计算
    汇总表不含单价/金额列，也没有单独的合计行（总人月落在明细表「合计」行内）。
    """
    part_donor = {c: ws[f"{c}3"] for c in "ABC"}
    h_part = ws.row_dimensions[3].height

    trim_rows(ws, 2)

    ws["A1"] = project_name
    for i, part in enumerate(parts):
        r = 3 + i
        safe = titles[i].replace("'", "''")
        ws.cell(r, 1, part["name"])                        # 费用项（部分名）
        ws.cell(r, 2, f"='{safe}'!K{last_rows[i]}")        # 数量（人月，引用明细「小计：人月」K）
        ws.cell(r, 3, NOTE_TEXT if i == 0 else "")          # 备注
        for c in "ABC":
            copy_style(part_donor[c], ws[f"{c}{r}"])
        ws[f"B{r}"].number_format = "0.00_ "   # 数量（人月）：与模板一致的显示格式
        ws.row_dimensions[r].height = h_part


def verify(output, spec, titles, last_rows):
    """重新打开生成文件，核对公式/小计范围/汇总引用，并汇报工作量统计。"""
    wb = openpyxl.load_workbook(output)
    problems = []
    summary_ws = wb["工作量汇总表"] if "工作量汇总表" in wb.sheetnames else wb.worksheets[0]
    grand_total_days = 0.0

    print("\n===== 生成结果核对 =====")
    # 与 main() 相同的合并逻辑：所有部分合并为一张 AI部分 明细表
    src_parts = spec.get("parts") or [{"name": DEFAULT_PART_NAME, "modules": spec.get("modules", [])}]
    merged = []
    for p in src_parts:
        merged.extend(p.get("modules", []))
    parts = [{"name": DEFAULT_PART_NAME, "modules": merged}]
    for i, part in enumerate(parts):
        ws = wb[titles[i]]
        subtotal_row = None
        for r in range(3, ws.max_row + 1):
            if str(ws.cell(r, 2).value or "").startswith("小计：人天"):
                subtotal_row = r
                break
        if subtotal_row is None:
            problems.append(f"{titles[i]}: 未找到「小计：人天」行")
            continue
        last_item = subtotal_row - 1
        # 数据行公式核对
        for r in range(3, last_item + 1):
            for c in "FGHIJ":
                v = ws[f"{c}{r}"].value
                if c == "H":
                    if not isinstance(v, (int, float)):
                        problems.append(f"{titles[i]}!H{r}: 编码人天应为数值，实际 {v!r}")
                elif v != f"=${c}$2*H{r}/$H$2":
                    problems.append(f"{titles[i]}!{c}{r}: 公式异常 {v!r}")
            if ws[f"K{r}"].value != f"=SUM(F{r}:J{r})":
                problems.append(f"{titles[i]}!K{r}: 合计公式异常 {ws[f'K{r}'].value!r}")
        # 小计行公式核对
        for c in TOTAL_COLUMNS:
            if ws[f"{c}{subtotal_row}"].value != f"=SUM({c}3:{c}{last_item})":
                problems.append(f"{titles[i]}!{c}{subtotal_row}: 小计公式异常 {ws[f'{c}{subtotal_row}'].value!r}")
            if ws[f"{c}{subtotal_row + 1}"].value != f"={c}{subtotal_row}/21.75":
                problems.append(f"{titles[i]}!{c}{subtotal_row + 1}: 人月公式异常 {ws[f'{c}{subtotal_row + 1}'].value!r}")
        # 公共部分每项编码人天必须在 0.5~3 之间（业务规则校验）
        if i == 0 and spec.get("include_common", False):
            common_names = {m["name"] for m in load_common_modules()}
            cur = None
            for r in range(3, last_item + 1):
                c = ws.cell(r, 3).value
                if c:
                    cur = c
                if cur in common_names:
                    h = ws.cell(r, 8).value
                    if not (isinstance(h, (int, float)) and COMMON_MIN <= h <= COMMON_MAX):
                        problems.append(f"公共部分「{cur}」{ws.cell(r, 4).value}: 编码人天 {h!r} 超出 {COMMON_MIN}~{COMMON_MAX} 范围")
        # 汇总引用核对
        ref = summary_ws[f"B{3 + i}"].value
        if ref != f"='{titles[i]}'!K{subtotal_row + 1}":
            problems.append(f"汇总表 B{3 + i}: 引用异常 {ref!r}")
        # 统计
        coding = sum(float(ws[f"H{r}"].value or 0) for r in range(3, last_item + 1))
        total_days = 2.5 * coding
        months = total_days / DAYS_PER_MONTH
        grand_total_days += total_days
        print(f"  「{titles[i]}」: 功能项 {last_item - 2} 个 | Σ编码人天 {coding:g} "
              f"| 合计人天 {total_days:g} | 人月 {months:.2f}")
        # 单张明细表时按模块输出分组统计
        mod_stats = {}
        cur = None
        for r in range(3, last_item + 1):
            m = ws.cell(r, 3).value
            if m:
                cur = m
            key = cur or "(未命名模块)"
            s = mod_stats.setdefault(key, [0, 0.0])
            s[0] += 1
            s[1] += float(ws.cell(r, 8).value or 0)
        if len(mod_stats) > 1:
            for m, (n, cd) in mod_stats.items():
                print(f"      - 模块「{m}」: {n} 项 | Σ编码人天 {cd:g}")

    grand_months = grand_total_days / DAYS_PER_MONTH
    print(f"  总计: 人月 {grand_months:.2f}")

    # 公共部分必须保留（追加到第一个明细表）
    if spec.get("include_common", False) and titles:
        present = set()
        ws0 = wb[titles[0]]
        for r in range(3, ws0.max_row + 1):
            v = ws0.cell(r, 3).value
            if v:
                present.add(v)
        for cm in load_common_modules():
            if cm["name"] not in present:
                problems.append(f"公共部分「{cm['name']}」未出现在明细表 {titles[0]} 中")

    if problems:
        print("\n[警告] 核对发现问题：")
        for p in problems:
            print("  -", p)
        sys.exit(2)
    print("[OK] 公式、小计范围、汇总引用全部核对通过")


def main():
    parser = argparse.ArgumentParser(description="按 spec JSON 生成工作量估算表")
    parser.add_argument("--spec", required=True, help="工作量 JSON 规范文件路径")
    parser.add_argument("-o", "--output", required=True, help="输出 xlsx 文件路径")
    parser.add_argument("--template", default=str(DEFAULT_TEMPLATE), help="模板 xlsx 路径（默认用技能自带模板）")
    args = parser.parse_args()

    template_path = Path(args.template)
    if not template_path.exists():
        fail(f"模板文件不存在: {template_path}")

    spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
    project_name = spec.get("project_name")
    if not project_name:
        fail("spec 缺少 project_name")
    parts = spec.get("parts")
    if not parts:
        # 新 schema：modules 直接顶级，全部归入 AI部分
        modules = spec.get("modules")
        if not modules:
            fail("spec 缺少 parts/modules 或为空")
        parts = [{"name": DEFAULT_PART_NAME, "modules": modules}]
    # 只输出一张明细表：所有部分合并为「AI部分」（汇总表一行 + 合计行 → 汇总表一行、无合计行）
    merged_modules = []
    for p in parts:
        merged_modules.extend(p.get("modules", []))
    if not merged_modules:
        fail("spec 没有任何功能模块")
    # 费用项名称：spec["part_name"] 可指定（默认 AI部分），用于汇总表「费用项」列与明细表 sheet 名
    part_name = spec.get("part_name") or DEFAULT_PART_NAME
    parts = [{"name": part_name, "modules": merged_modules}]

    # 公共部分（域登录与安全/系统日志管理/系统安全）自动追加到第一个明细部分
    append_common_modules(parts, spec)

    wb = openpyxl.load_workbook(template_path)

    summary_ws = wb["工作量汇总表"] if "工作量汇总表" in wb.sheetnames else wb.worksheets[0]
    detail_sheets = [ws for ws in wb.worksheets if ws is not summary_ws]
    if not detail_sheets:
        fail("模板中未找到明细 sheet")

    titles = [sanitize_sheet_title(p["name"]) for p in parts]
    if len(set(titles)) != len(titles):
        fail("部分名称重复，会导致 sheet 重名")
    if any(t == summary_ws.title for t in titles):
        fail("部分名称与汇总表名称冲突")

    # 明细 sheet 数量对齐
    while len(detail_sheets) < len(parts):
        detail_sheets.append(wb.copy_worksheet(detail_sheets[-1]))
    for extra in detail_sheets[len(parts):]:
        wb.remove(extra)
    detail_sheets = detail_sheets[:len(parts)]

    # 明细表序号从 1 开始（每张表独立编号，与汇总表行号无关）
    last_rows = []
    for ws, title, part in zip(detail_sheets, titles, parts):
        last_rows.append(build_detail_sheet(ws, title, project_name, part["modules"], 1))
    build_summary(summary_ws, project_name, parts, titles, last_rows)

    wb.save(args.output)
    print(f"已生成: {args.output}")
    verify(args.output, spec, titles, last_rows)


if __name__ == "__main__":
    main()