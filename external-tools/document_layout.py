"""Recover ruled table cells from local OCR geometry without deleting repeated values."""
import cv2
import numpy as np

LAYOUT_VERSION = 1


def cluster(values, tolerance=12):
    groups = []
    for value in sorted(values):
        if not groups or value - np.mean(groups[-1]) > tolerance:
            groups.append([value])
        else:
            groups[-1].append(value)
    return [float(np.mean(group)) for group in groups]


def touching(a, b):
    x, y, w, h = a['box']
    X, Y, W, H = b['box']
    return ((min(y+h, Y+H)-max(y, Y) > 8 and min(abs(x+w-X), abs(X+W-x)) < 12)
            or (min(x+w, X+W)-max(x, X) > 8 and min(abs(y+h-Y), abs(Y+H-y)) < 12))


def ordered_text(lines):
    rows = []
    for line in sorted(lines, key=lambda item: (item['y'], item['x'])):
        if rows and abs(line['y'] - rows[-1][0]['y']) < max(8, line['height'] * .45):
            rows[-1].append(line)
        else:
            rows.append([line])
    return '\n'.join(' '.join(item['text'] for item in sorted(row, key=lambda item: item['x'])) for row in rows)


def recover(picture, lines):
    gray = cv2.cvtColor(np.asarray(picture), cv2.COLOR_RGB2GRAY)
    ink = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 12)
    horizontal = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (50, 1)))
    vertical = cv2.morphologyEx(ink, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 45)))
    grid = cv2.dilate(horizontal | vertical, np.ones((3, 3), np.uint8))
    contours, _ = cv2.findContours(255-grid, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cells = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w < 30 or h < 28 or w*h > gray.size*.25 or abs(cv2.contourArea(contour)-w*h)/(w*h) > .22:
            continue
        cells.append({'box': [x, y, w, h], 'lines': []})
    parent = list(range(len(cells)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(cells)):
        for j in range(i):
            if touching(cells[i], cells[j]):
                parent[find(i)] = find(j)
    groups = {}
    for i, cell in enumerate(cells):
        groups.setdefault(find(i), []).append(cell)
    groups = [group for group in groups.values() if len(group) >= 4]
    kept = [cell for group in groups for cell in group]
    outside = []
    for line in lines:
        box = np.asarray(line.get('box'))
        if box.shape != (4, 2):
            outside.append({'x': 0, 'y': gray.shape[0], 'height': 20, 'text': line['text']})
            continue
        cx, cy = box.mean(axis=0)
        item = {'x': float(cx), 'y': float(cy), 'height': float(box[:, 1].max()-box[:, 1].min()), 'text': line['text']}
        hit = next((cell for cell in kept if cell['box'][0] <= cx <= cell['box'][0]+cell['box'][2]
                    and cell['box'][1] <= cy <= cell['box'][1]+cell['box'][3]), None)
        (outside if hit is None else hit['lines']).append(item)
    blocks = []
    for group in groups:
        xs = cluster([v for cell in group for v in (cell['box'][0], cell['box'][0]+cell['box'][2])])
        ys = cluster([v for cell in group for v in (cell['box'][1], cell['box'][1]+cell['box'][3])])
        if len(xs) < 3 or len(ys) < 2:
            outside.extend(line for cell in group for line in cell['lines'])
            continue
        rows = [[] for _ in range(len(ys)-1)]
        for cell in group:
            x, y, w, h = cell['box']
            col = min(range(len(xs)), key=lambda i: abs(xs[i]-x))
            row = min(range(len(ys)), key=lambda i: abs(ys[i]-y))
            endcol = min(range(len(xs)), key=lambda i: abs(xs[i]-x-w))
            endrow = min(range(len(ys)), key=lambda i: abs(ys[i]-y-h))
            if row >= len(rows) or col >= len(xs)-1:
                outside.extend(cell['lines'])
                continue
            rows[row].append({'col': col, 'colspan': max(1, endcol-col), 'rowspan': max(1, endrow-row), 'text': ordered_text(cell['lines'])})
        for row in rows:
            row.sort(key=lambda cell: cell['col'])
        blocks.append({'type': 'table', 'y': ys[0], 'rows': rows, 'columns': len(xs)-1,
                       'widths': [round(100*(xs[i+1]-xs[i])/(xs[-1]-xs[0]), 2) for i in range(len(xs)-1)]})
    for line in outside:
        blocks.append({'type': 'text', 'y': line['y'], 'text': line['text']})
    blocks.sort(key=lambda block: block['y'])
    return blocks


def finish_pages(pages):
    previous = {}
    for page in pages:
        current = {}
        for block in page.get('blocks', []):
            if block['type'] != 'table':
                continue
            header = next((row for row in block['rows'] if any(cell['text'].replace('\n', '') in ('序号', '编号') for cell in row)
                           and len(row) >= 3), None)
            if header:
                block['headerRow'] = block['rows'].index(header)
                current[block['columns']] = header
            elif block['columns'] in previous:
                block['continuedHeader'] = previous[block['columns']]
                current[block['columns']] = previous[block['columns']]
        previous = current
    return pages


def blocks_text(blocks):
    """Column-labelled rows give the report model the same table structure as the reader."""
    output = []
    for block in blocks:
        if block['type'] == 'text':
            output.append(block['text'])
            continue
        columns = block['columns']
        headers = ['列'+str(i+1) for i in range(columns)]
        heading = block.get('continuedHeader') or (block['rows'][block['headerRow']] if 'headerRow' in block else [])
        for cell in heading:
            if cell['colspan'] == 1:
                headers[cell['col']] = cell['text'].replace('\n', '')
        occupied = {}
        output.append('[表格]')
        for index, row in enumerate(block['rows']):
            for cell in row:
                for col in range(cell['col'], min(columns, cell['col']+cell['colspan'])):
                    occupied[col] = (index+cell['rowspan'], cell['text'].replace('\n', '；' if block.get('preserveLines') else ''))
            if index == block.get('headerRow'):
                continue
            output.append(' | '.join(headers[col]+': '+occupied[col][1] for col in range(columns) if col in occupied and occupied[col][0] > index))
        output.append('[/表格]')
    return '\n'.join(output)
