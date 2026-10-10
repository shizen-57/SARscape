"""Exit scientific workers when their owning backend exits or restarts."""
import os,sys,threading,time
def watch_parent():
    if '--parent-pid' not in sys.argv:return
    parent=int(sys.argv[sys.argv.index('--parent-pid')+1])
    def watch():
        if os.name=='nt':
            import ctypes
            kernel=ctypes.WinDLL('kernel32',use_last_error=True)
            kernel.OpenProcess.argtypes=[ctypes.c_uint32,ctypes.c_int,ctypes.c_uint32];kernel.OpenProcess.restype=ctypes.c_void_p
            kernel.WaitForSingleObject.argtypes=[ctypes.c_void_p,ctypes.c_uint32];kernel.CloseHandle.argtypes=[ctypes.c_void_p]
            handle=kernel.OpenProcess(0x00100000,False,parent)
            if handle:kernel.WaitForSingleObject(handle,0xFFFFFFFF);kernel.CloseHandle(handle)
        else:
            while True:
                try:os.kill(parent,0)
                except ProcessLookupError:break
                time.sleep(.25)
        os._exit(0)
    threading.Thread(target=watch,daemon=True).start()
