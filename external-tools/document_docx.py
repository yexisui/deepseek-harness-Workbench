"""Read native Word paragraphs and merged tables into the shared document reader."""
import copy
import math
import re
import zipfile
import xml.etree.ElementTree as ET

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{'+NS['w']+'}'
VERSION = 2
PAGE_LINES = 36


def value(node, query, default=None):
    found = node.find(query, NS) if node is not None else None
    return found.get(W+'val', default) if found is not None else default


def paragraph_text(node):
    def visit(item):
        if item.tag in (W+'del', W+'moveFrom'):
            return ''
        if item.tag == W+'t': return item.text or ''
        if item.tag == W+'tab': return '\t'
        if item.tag in (W+'br', W+'cr'): return '\n'
        if item.tag == W+'noBreakHyphen': return '‑'
        return ''.join(visit(child) for child in item)
    return visit(node).strip()


class Reader:
    def __init__(self, archive):
        self.styles = {}
        if 'word/styles.xml' in archive.namelist():
            styles = ET.fromstring(archive.read('word/styles.xml'))
            self.styles = {style.get(W+'styleId'): style for style in styles.findall('w:style', NS)}
        self.levels, self.numbers, self.counts = {}, {}, {}
        if 'word/numbering.xml' in archive.namelist():
            numbering = ET.fromstring(archive.read('word/numbering.xml'))
            for abstract in numbering.findall('w:abstractNum', NS):
                self.levels[abstract.get(W+'abstractNumId')] = {int(level.get(W+'ilvl', '0')): level for level in abstract.findall('w:lvl', NS)}
            for number in numbering.findall('w:num', NS):
                levels = dict(self.levels.get(value(number, 'w:abstractNumId'), {}))
                for override in number.findall('w:lvlOverride', NS):
                    level = int(override.get(W+'ilvl', '0'))
                    if override.find('w:lvl', NS) is not None: levels[level] = override.find('w:lvl', NS)
                    start = value(override, 'w:startOverride')
                    if start is not None and level in levels:
                        levels[level] = copy.deepcopy(levels[level])
                        setting = levels[level].find('w:start', NS)
                        if setting is None: setting = ET.SubElement(levels[level], W+'start')
                        setting.set(W+'val', start)
                self.numbers[number.get(W+'numId')] = levels

    def properties(self, paragraph):
        own = paragraph.find('w:pPr', NS)
        result = [own] if own is not None else []
        style_id = value(paragraph, 'w:pPr/w:pStyle')
        visited = set()
        while style_id in self.styles and style_id not in visited:
            visited.add(style_id)
            style = self.styles[style_id]
            properties = style.find('w:pPr', NS)
            if properties is not None: result.append(properties)
            style_id = value(style, 'w:basedOn')
        return result

    def prefix(self, properties):
        number = next((value(p, 'w:numPr/w:numId') for p in properties if value(p, 'w:numPr/w:numId') is not None), None)
        if not number or number == '0': return ''
        level = int(next((value(p, 'w:numPr/w:ilvl') for p in properties if value(p, 'w:numPr/w:ilvl') is not None), '0'))
        levels = self.numbers.get(number, {})
        if level not in levels: return ''
        rule = levels[level]
        counters = self.counts.setdefault(number, {})
        counters[level] = counters.get(level, int(value(rule, 'w:start', '1'))-1)+1
        for deeper in list(counters):
            if deeper > level: del counters[deeper]
        template = value(rule, 'w:lvlText', '%'+str(level+1)+'.')
        if value(rule, 'w:numFmt') == 'bullet': return '• '
        def replace(match):
            key = int(match.group(1))-1
            count = counters.get(key, int(value(levels.get(key), 'w:start', '1')))
            fmt = value(levels.get(key), 'w:numFmt', 'decimal')
            if fmt in ('lowerLetter', 'upperLetter'):
                chars = ''; remaining = count
                while remaining > 0:
                    remaining, digit = divmod(remaining-1, 26); chars = chr(97+digit)+chars
                return chars.upper() if fmt == 'upperLetter' else chars
            if fmt == 'decimalZero': return str(count).zfill(2)
            return str(count)
        return re.sub(r'%(\d+)', replace, template)+' '

    def paragraph(self, node):
        text = paragraph_text(node)
        if not text: return None
        properties = self.properties(node)
        outline = next((value(p, 'w:outlineLvl') for p in properties if value(p, 'w:outlineLvl') is not None), None)
        result = {'type': 'text', 'text': self.prefix(properties)+text}
        if outline is not None and int(outline) < 9: result['headingLevel'] = min(6, int(outline)+1)
        if any(value(p, 'w:pageBreakBefore') not in (None, '0', 'false', 'off') or p.find('w:pageBreakBefore', NS) is not None and value(p, 'w:pageBreakBefore') is None for p in properties):
            result['breakBefore'] = True
        return result

    def blocks(self, parent):
        result = []
        for child in parent:
            if child.tag == W+'p':
                block = self.paragraph(child)
                if block: result.append(block)
            elif child.tag == W+'tbl': result.append(self.table(child))
            elif child.tag in (W+'sdt', W+'sdtContent', W+'customXml', W+'ins', W+'moveTo'):
                result.extend(self.blocks(child))
        return result

    def table(self, node):
        grid = node.findall('w:tblGrid/w:gridCol', NS)
        widths = [int(col.get(W+'w', '1')) for col in grid]
        rows, active, header_rows = [], {}, []
        for row_index, row in enumerate(node.findall('w:tr', NS)):
            cells, next_active = [], {}
            col = int(value(row, 'w:trPr/w:gridBefore', '0'))
            if col: cells.append({'col': 0, 'colspan': col, 'rowspan': 1, 'text': ''})
            for cell in row.findall('w:tc', NS):
                span = max(1, int(value(cell, 'w:tcPr/w:gridSpan', '1')))
                blocks = self.blocks(cell)
                text = plain_text(blocks)
                merge = cell.find('w:tcPr/w:vMerge', NS)
                origin = active.get((col, span))
                if merge is not None and merge.get(W+'val') != 'restart' and origin is not None:
                    origin['rowspan'] += 1
                    if text:
                        origin['blocks'].extend(blocks)
                        origin['text'] += '\n'+text
                    next_active[(col, span)] = origin
                else:
                    entry = {'col': col, 'colspan': span, 'rowspan': 1, 'text': text, 'blocks': blocks}
                    cells.append(entry)
                    if merge is not None: next_active[(col, span)] = entry
                col += span
            after = int(value(row, 'w:trPr/w:gridAfter', '0'))
            if after: cells.append({'col': col, 'colspan': after, 'rowspan': 1, 'text': ''}); col += after
            while len(widths) < col: widths.append(1)
            rows.append(cells); active = next_active
            if row.find('w:trPr/w:tblHeader', NS) is not None and value(row, 'w:trPr/w:tblHeader') not in ('0', 'false', 'off'):
                header_rows.append(row_index)
        columns = max(1, len(widths)); total = sum(widths) or 1
        result = {'type': 'table', 'columns': columns, 'widths': [round(100*w/total, 2) for w in widths], 'rows': rows, 'preserveLines': True}
        header = next((i for i in header_rows if len(rows[i]) > 1), None)
        if header is None:
            header = next((i for i, row in enumerate(rows[:5]) if any(cell['text'].strip() in ('序号', '编号') for cell in row)), None)
        if header is None and rows and len(rows[0]) > 1 and all(len(cell['text']) <= 40 for cell in rows[0]): header = 0
        if header is not None: result['headerRow'] = header
        return result


def plain_text(blocks):
    parts = []
    for block in blocks:
        if block['type'] == 'text': parts.append(block['text'])
        else:
            for row in block['rows']: parts.append(' | '.join(cell['text'] for cell in row))
    return '\n'.join(parts)


def row_lines(row, columns):
    return max([2]+[max(1, sum(math.ceil(len(line)/max(6, 52*cell['colspan']/columns)) for line in cell['text'].split('\n')))/cell['rowspan']+1 for cell in row])


def table_slice(table, start, end):
    result = {key: copy.deepcopy(item) for key, item in table.items() if key not in ('rows', 'headerRow')}
    rows = [[] for _ in range(end-start)]
    for index, row in enumerate(table['rows'][:end]):
        for cell in row:
            bottom = index+cell['rowspan']
            if bottom <= start: continue
            target = max(index, start)
            copy_cell = copy.deepcopy(cell)
            copy_cell['rowspan'] = min(end, bottom)-target
            rows[target-start].append(copy_cell)
    for row in rows: row.sort(key=lambda cell: cell['col'])
    result['rows'] = rows
    header = table.get('headerRow')
    if header is not None:
        if start <= header < end: result['headerRow'] = header-start
        elif header < start:
            result['continuedHeader'] = [{**copy.deepcopy(cell), 'rowspan': 1} for cell in table['rows'][header]]
    return result


def paginate(blocks):
    pages, current, used = [], [], 0
    def flush():
        nonlocal current, used
        if current: pages.append(current)
        current, used = [], 0
    for block in blocks:
        if block['type'] == 'text':
            if block.get('breakBefore') or block.get('headingLevel') and used > PAGE_LINES-6: flush()
            # A long paragraph is divided at sentence boundaries, retaining every character.
            pieces = re.findall(r'.{1,1400}(?:[。；\n]|$)|.{1,1400}', block['text'], re.S)
            for piece in pieces:
                cost = sum(max(1, math.ceil(len(line)/52)) for line in piece.split('\n'))+1
                if used+cost > PAGE_LINES: flush()
                current.append({**block, 'text': piece}); used += cost
            continue
        rows = block['rows']; start = 0
        while start < len(rows):
            if used > PAGE_LINES-8: flush()
            cost = 3 if start and 'headerRow' in block else 0
            end = start
            while end < len(rows):
                next_cost = row_lines(rows[end], block['columns'])
                if end > start and used+cost+next_cost > PAGE_LINES: break
                cost += next_cost; end += 1
                if end-start >= 16: break
            current.append(table_slice(block, start, end)); used += cost+1; start = end
            if start < len(rows): flush()
    flush()
    return pages


def read_docx(source):
    from document_layout import blocks_text
    with zipfile.ZipFile(source) as archive:
        document = ET.fromstring(archive.read('word/document.xml'))
        body = document.find('w:body', NS)
        if body is None: raise ValueError('Word 文档缺少正文内容')
        blocks = Reader(archive).blocks(body)
    pages = []
    for index, group in enumerate(paginate(blocks)):
        pages.append({'page': index+1, 'text': plain_text(group), 'method': 'docx', 'blocks': group,
                      'structuredText': blocks_text(group), 'layoutVersion': VERSION})
    if not pages: pages = [{'page': 1, 'text': '', 'method': 'docx', 'blocks': [], 'layoutVersion': VERSION}]
    return {'pages': pages, 'needsOcr': False}
