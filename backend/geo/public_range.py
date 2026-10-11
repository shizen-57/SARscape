"""Bounded anonymous reads of public scientific NetCDFs hosted by NASA ITS_LIVE."""
import io
from collections import OrderedDict
from urllib.parse import urlsplit


class PublicRangeReader(io.RawIOBase):
    def __init__(self, session, url, budget=40 * 1024**2):
        super().__init__()
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.hostname != 'its-live-data.s3.amazonaws.com' or parsed.query:
            raise ValueError('Expected a public NASA ITS_LIVE source URL')
        response = session.head(url, timeout=45)
        response.raise_for_status()
        self.size = int(response.headers['Content-Length'])
        self.session, self.url, self.budget = session, url, budget
        self.position, self.transferred, self.block_size = 0, 0, 128 * 1024
        self.cache = OrderedDict()

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.position

    def seek(self, offset, whence=0):
        position = offset if whence == 0 else self.position + offset if whence == 1 else self.size + offset
        if position < 0: raise ValueError('Negative seek')
        self.position = position
        return position

    def read(self, size=-1):
        end = min(self.size, self.position + size if size >= 0 else self.size)
        if end - self.position > self.budget: raise ValueError('Read budget exceeded')
        result = bytearray()
        while self.position < end:
            index, offset = divmod(self.position, self.block_size)
            if index not in self.cache:
                start, stop = index * self.block_size, min((index + 1) * self.block_size, self.size) - 1
                length = stop - start + 1
                if self.transferred + length > self.budget: raise ValueError('Regional read budget exceeded')
                if hasattr(self.session, 'regional_budget') and self.session.regional_transferred + length > self.session.regional_budget:
                    raise ValueError('Total workflow byte budget exceeded; cached products remain available')
                with self.session.get(self.url, headers={'Range': f'bytes={start}-{stop}', 'Accept-Encoding': 'identity'}, stream=True, timeout=60) as r:
                    if r.status_code != 206 or r.headers.get('Content-Range') != f'bytes {start}-{stop}/{self.size}':
                        raise ValueError('Server did not honor regional byte ranges; full downloads disabled')
                    block = r.raw.read(length + 1)
                    if len(block) != length: raise ValueError('Incomplete or oversized range')
                self.transferred += length
                if hasattr(self.session, 'regional_budget'): self.session.regional_transferred += length
                self.cache[index] = block
                if len(self.cache) > 256: self.cache.popitem(last=False)
            self.cache.move_to_end(index)
            count = min(end - self.position, len(self.cache[index]) - offset)
            result.extend(self.cache[index][offset:offset + count]); self.position += count
        return bytes(result)

    def readinto(self, buffer):
        data = self.read(len(buffer)); buffer[:len(data)] = data; return len(data)
