"""Local HTTP service for cached, genuine optical observations."""
import os, threading, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from optical_tiles import MANIFEST, CACHE, SLOTS, DETAIL_SLOTS, render
from indices import render_tile as render_index_tile

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200); self.end_headers(); self.wfile.write(b'OK'); return
        parts = self.path.split('/')
        try:
            if len(parts)==8 and parts[1]=='index':
                _,_,scenario,frame_id,mode,z,x,y=parts
                if scenario not in MANIFEST['scenarios'] or mode not in ['index','change'] or not any(f['id']==frame_id for f in MANIFEST['scenarios'][scenario]):raise ValueError('Invalid index study')
                z,x,y=int(z),int(x),int(y.removesuffix('.png'))
                if not 0<=z<=14 or not 0<=x<2**z or not 0<=y<2**z:raise ValueError('Invalid index tile')
                data=render_index_tile(scenario,frame_id,z,x,y,mode=='change')
                self.send_response(200);self.send_header('Content-Type','image/png');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
            if len(parts) != 7 or parts[1] != 'tile': raise ValueError('Invalid tile')
            _,_,scenario,frame_id,z,x,y = parts
            z,x,y = int(z),int(x),int(y.removesuffix('.png'))
            if not 0 <= z <= 17 or not 0 <= x < 2**z or not 0 <= y < 2**z: raise ValueError('Invalid tile bounds')
            frame = next((f for f in MANIFEST['scenarios'].get(scenario,[]) if f['id'] == frame_id or f.get('sourceSceneId') == frame_id), None)
            if not frame: raise ValueError('Unknown frame')
            target = CACHE / scenario / frame.get('sourceSceneId',frame_id) / str(z) / str(x) / f'{y}.png'
            if target.exists(): data = target.read_bytes()
            else:
                with (DETAIL_SLOTS if z>=13 else SLOTS):
                    data = render(frame,z,x,y,scenario)
                    target.parent.mkdir(parents=True,exist_ok=True)
                    temporary = target.with_suffix(f'.{threading.get_ident()}.tmp')
                    temporary.write_bytes(data); os.replace(temporary,target)
            self.send_response(200)
            self.send_header('Content-Type','image/png')
            self.send_header('Content-Length',str(len(data)))
            self.send_header('Cache-Control','public,max-age=31536000,immutable')
            self.end_headers(); self.wfile.write(data)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass
        except ValueError as error:
            self.send_error(404,str(error))
        except Exception as error:
            print(f'Raster processing failed: {type(error).__name__}: {error}',flush=True)
            try: self.send_error(502,'Could not render observation tile')
            except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError): pass
    def log_message(self,*args): pass

def watch_parent():
    """Windows watch mode can terminate Node without running its exit hooks."""
    if '--parent-pid' not in sys.argv: return
    parent=int(sys.argv[sys.argv.index('--parent-pid')+1])
    if os.name=='nt':
        import ctypes
        kernel=ctypes.WinDLL('kernel32',use_last_error=True)
        kernel.OpenProcess.argtypes=[ctypes.c_uint32,ctypes.c_int,ctypes.c_uint32]
        kernel.OpenProcess.restype=ctypes.c_void_p
        kernel.WaitForSingleObject.argtypes=[ctypes.c_void_p,ctypes.c_uint32]
        handle=kernel.OpenProcess(0x00100000,False,parent)
        if handle: kernel.WaitForSingleObject(handle,0xFFFFFFFF)
    else:
        while True:
            try: os.kill(parent,0)
            except ProcessLookupError: break
            time.sleep(0.25)
    os._exit(0)

threading.Thread(target=watch_parent,daemon=True).start()
print('Geospatial tile processor ready on 127.0.0.1:8788',flush=True)
ThreadingHTTPServer(('127.0.0.1',8788),Handler).serve_forever()
