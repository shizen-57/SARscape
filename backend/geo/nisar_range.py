"""Seekable, bounded HTTPS reads for HDF5; never fall back to a full download."""
import io
import re
from collections import OrderedDict
from urllib.parse import urlsplit


class RangeReader(io.RawIOBase):
    def __init__(self, session, url, size, budget, block_size=256 * 1024):
        super().__init__()
        parsed = urlsplit(url)
        if parsed.scheme != 'https' or parsed.hostname != 'nisar.asf.earthdatacloud.nasa.gov' or parsed.query or parsed.fragment:
            raise ValueError('Only official ASF NISAR science URLs are supported')
        if size <= 0:
            raise ValueError('A known source file size is required')
        self.session, self.url, self.fetch_url = session, url, url
        self.size, self.budget, self.block_size = size, budget, block_size
        self.position, self.transferred, self.requests = 0, 0, 0
        self.cache, self.etag = OrderedDict(), None

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.position

    def seek(self, offset, whence=io.SEEK_SET):
        position = offset if whence == io.SEEK_SET else self.position + offset if whence == io.SEEK_CUR else self.size + offset if whence == io.SEEK_END else -1
        if position < 0: raise ValueError('Invalid seek')
        self.position = position
        return position

    def _block(self, index):
        if index in self.cache:
            self.cache.move_to_end(index)
            return self.cache[index]
        start = index * self.block_size
        end = min(start + self.block_size, self.size) - 1
        length = end - start + 1
        if self.transferred + length > self.budget:
            raise ValueError('Regional read reached the transfer limit; no full file was downloaded')
        headers = {'Range': f'bytes={start}-{end}', 'Accept-Encoding': 'identity'}
        if self.etag: headers['If-Match'] = self.etag
        self.requests += 1
        with self.session.get(self.fetch_url, headers=headers, stream=True, timeout=(20, 90)) as response:
            # Check before consuming a body: a server ignoring Range must not fill the disk.
            if response.status_code != 206:
                raise ValueError(f'ASF range access returned HTTP {response.status_code}; full downloads are disabled')
            host = urlsplit(response.url).hostname or ''
            if not (host == 'nisar.asf.earthdatacloud.nasa.gov' or host.endswith('.cloudfront.net')):
                raise ValueError('Unexpected science-file redirect')
            match = re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)', response.headers.get('Content-Range', ''))
            if not match or tuple(map(int, match.groups())) != (start, end, self.size):
                raise ValueError('ASF returned an inconsistent byte range')
            if response.headers.get('Content-Encoding', 'identity') != 'identity':
                raise ValueError('Compressed HTTP ranges cannot be used for HDF5')
            if int(response.headers.get('Content-Length', length)) != length:
                raise ValueError('ASF returned an inconsistent range length')
            etag = response.headers.get('ETag')
            if self.etag and etag != self.etag:
                raise ValueError('The remote source changed while it was being read')
            self.etag = etag
            result = bytearray()
            for chunk in response.iter_content(64 * 1024):
                self.transferred += len(chunk)
                if self.transferred > self.budget or len(result) + len(chunk) > length:
                    raise ValueError('ASF exceeded the requested transfer limit')
                result.extend(chunk)
            if len(result) != length: raise ValueError('Incomplete remote byte range')
            # Signed redirect addresses stay in memory only.
            self.fetch_url = response.url
        self.cache[index] = bytes(result)
        while len(self.cache) > 64: self.cache.popitem(last=False)
        return self.cache[index]

    def read(self, size=-1):
        if self.closed: raise ValueError('Reader is closed')
        size = self.size - self.position if size is None or size < 0 else size
        end = min(self.position + size, self.size)
        if size < 0 or end <= self.position: return b''
        if end - self.position > self.budget: raise ValueError('Requested read exceeds the transfer limit')
        result = bytearray()
        while self.position < end:
            index, offset = divmod(self.position, self.block_size)
            block = self._block(index)
            take = min(len(block) - offset, end - self.position)
            result.extend(block[offset:offset + take])
            self.position += take
        return bytes(result)

    def readinto(self, buffer):
        data = self.read(len(buffer))
        buffer[:len(data)] = data
        return len(data)

    def close(self):
        if hasattr(self, 'cache'): self.cache.clear()
        super().close()
