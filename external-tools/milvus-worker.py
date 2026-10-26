"""Workbench-owned JSON-lines bridge. Secrets arrive on stdin, never argv/logs."""
import sys,json,hashlib,base64,io,logging
from pathlib import Path
import os
logging.disable(logging.CRITICAL)
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
clients={}
if sys.platform=='win32':
 # FAISS's C stdio file APIs reject Unicode paths on Windows. Keep upstream
 # index bytes unchanged and route file I/O through Python's Unicode APIs.
 import faiss,numpy as np
 original_write,original_read=faiss.write_index,faiss.read_index
 def unicode_write(index,path,*args):
  if not isinstance(path,(str,os.PathLike)):return original_write(index,path,*args)
  target=Path(path);temporary=target.with_name(target.name+'.writing')
  temporary.write_bytes(faiss.serialize_index(index).tobytes());os.replace(temporary,target)
 def unicode_read(path,*args):
  if not isinstance(path,(str,os.PathLike)):return original_read(path,*args)
  return faiss.deserialize_index(np.frombuffer(Path(path).read_bytes(),dtype=np.uint8))
 faiss.write_index=unicode_write;faiss.read_index=unicode_read
loaded=set()
def client(a):
 from pymilvus import MilvusClient
 key=hashlib.sha256(json.dumps(a,sort_keys=True).encode()).hexdigest()
 if key not in clients:clients[key]=MilvusClient(uri=a['uri'],token=a.get('token',''),db_name=a.get('database','default'),timeout=15)
 return clients[key]
def execute(a):
 op=a['op']
 if op=='ping':
  import importlib.metadata as m
  return {'milvus':m.version('milvus-lite'),'python':sys.version.split()[0]}
 if op=='pdf':
  from pypdf import PdfReader
  reader=PdfReader(io.BytesIO(base64.b64decode(a['data'])))
  return [{'text':p.extract_text() or '', 'locator':f'第 {i+1} 页'} for i,p in enumerate(reader.pages)]
 if op=='parquet':
  import pyarrow.parquet as pq
  return pq.read_table(io.BytesIO(base64.b64decode(a['data']))).to_pylist()
 c=client(a['connection']);name=a.get('collection','')
 if op=='collections':return [{'name':n,'schema':c.describe_collection(n)} for n in c.list_collections()]
 if op=='ensure':
  from pymilvus import DataType
  if not c.has_collection(name):
   s=c.create_schema(auto_id=False,enable_dynamic_field=False)
   s.add_field('id',DataType.VARCHAR,is_primary=True,max_length=96)
   s.add_field('vector',DataType.FLOAT_VECTOR,dim=a['dimension'])
   for field,size in [('revision',64),('document',64),('text',65535),('locator',2000)]:s.add_field(field,DataType.VARCHAR,max_length=size)
   index=c.prepare_index_params();index.add_index(field_name='vector',index_type='AUTOINDEX',metric_type='COSINE')
   c.create_collection(name,schema=s,index_params=index)
  return {'ready':True}
 if op=='insert':c.upsert(name,a['rows']);c.flush(name);return {'count':len(a['rows'])}
 if op=='delete':return c.delete(name,filter=a['filter'])
 if op=='export':
  iterator=c.query_iterator(name,filter=a['filter'],output_fields=['vector','text','locator','document'],batch_size=256)
  rows=[]
  try:
   while True:
    batch=iterator.next()
    if not batch:break
    rows.extend(batch)
    if len(rows)>10000:raise ValueError('export limit')
  finally:iterator.close()
  return rows
 if op=='drop':
  if c.has_collection(name):c.drop_collection(name)
  return {'removed':True}
 if op=='search':
  if not a['connection']['uri'].startswith(('http://','https://')) and name not in loaded:
   c.load_collection(name);loaded.add(name)
  result=c.search(name,[a['vector']],anns_field=a.get('field','vector'),filter=a.get('filter',''),limit=a['limit'],output_fields=a['fields'],search_params={'metric_type':a.get('metric','COSINE')},timeout=30)
  return list(result[0])
 raise ValueError('unsupported operation')
for line in sys.stdin:
 try:
  request=json.loads(line);result=execute(request['data']);reply={'id':request['id'],'result':result}
 except Exception as e:
  # Vendor exceptions often contain request arguments, including credentials.
  reply={'id':request.get('id','') if 'request' in locals() else '', 'error':'知识库存储操作失败（'+type(e).__name__+'），请检查连接、字段和运行环境。'}
 print(json.dumps(reply,ensure_ascii=True,default=str),flush=True)
for c in clients.values():
 try:c.close()
 except Exception:pass
