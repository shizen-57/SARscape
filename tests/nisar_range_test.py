"""Network-free regression checks for bounded NISAR HDF5 range reads."""
import io
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'backend/geo'))
from nisar_range import RangeReader


SOURCE_URL = 'https://nisar.asf.earthdatacloud.nasa.gov/NISAR/fixture.h5'


class FakeResponse:
    def __init__(self, url, body, headers, status=206):
        self.url = url
        self.body = body
        self.headers = headers
        self.status_code = status
        self.body_consumed = False
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *arguments):
        self.closed = True

    def iter_content(self, chunk_size):
        self.body_consumed = True
        for start in range(0, len(self.body), chunk_size):
            yield self.body[start:start + chunk_size]


class FakeSession:
    def __init__(self, data, overrides=()):
        self.data = data
        self.overrides = list(overrides)
        self.calls = []
        self.responses = []

    def get(self, url, *, headers, stream, timeout):
        start, end = map(int, headers['Range'].removeprefix('bytes=').split('-'))
        body = self.data[start:end + 1]
        response_headers = {
            'Content-Range': f'bytes {start}-{end}/{len(self.data)}',
            'Content-Length': str(len(body)),
            'ETag': 'version-one',
        }
        override = self.overrides[len(self.calls)] if len(self.calls) < len(self.overrides) else {}
        response_headers.update(override.get('headers', {}))
        response = FakeResponse(url, body, response_headers, override.get('status', 206))
        self.calls.append({'url': url, 'headers': headers.copy(), 'stream': stream, 'timeout': timeout})
        self.responses.append(response)
        return response


class RangeReaderTests(unittest.TestCase):
    def reader(self, data=bytes(range(50)), budget=100, overrides=()):
        session = FakeSession(data, overrides)
        reader = RangeReader(session, SOURCE_URL, len(data), budget, block_size=8)
        self.addCleanup(reader.close)
        return reader, session

    def test_seeking_cache_and_partial_last_block(self):
        reader, session = self.reader()
        self.assertEqual(reader.read(3), bytes(range(3)))
        self.assertEqual(reader.read(14), bytes(range(3, 17)))
        self.assertEqual(reader.seek(-4, io.SEEK_END), 46)
        self.assertEqual(reader.read(), bytes(range(46, 50)))
        self.assertEqual(reader.read(), b'')
        self.assertEqual(reader.tell(), 50)
        self.assertEqual(reader.transferred, 34)
        self.assertEqual(reader.requests, 5)
        reader.seek(0)
        self.assertEqual(reader.read(5), bytes(range(5)))
        self.assertEqual(reader.transferred, 34)
        self.assertEqual(len(session.calls), 5)
        reader.seek(100)
        self.assertEqual(reader.read(), b'')
        self.assertTrue(all(call['stream'] for call in session.calls))
        self.assertTrue(all(call['headers']['Accept-Encoding'] == 'identity' for call in session.calls))

    def test_exact_budget_boundary_and_cached_reads(self):
        reader, session = self.reader(budget=8)
        self.assertEqual(reader.read(8), bytes(range(8)))
        self.assertEqual(reader.transferred, 8)
        with self.assertRaisesRegex(ValueError, 'transfer limit'):
            reader.read(1)
        self.assertEqual(len(session.calls), 1)
        self.assertEqual(reader.transferred, 8)
        reader.seek(0)
        self.assertEqual(reader.read(8), bytes(range(8)))
        self.assertEqual(len(session.calls), 1)

    def test_http_200_is_rejected_before_consuming_body(self):
        reader, session = self.reader(overrides=[{'status': 200}])
        with self.assertRaisesRegex(ValueError, 'HTTP 200'):
            reader.read(1)
        self.assertFalse(session.responses[0].body_consumed)
        self.assertTrue(session.responses[0].closed)
        self.assertEqual(reader.transferred, 0)
        self.assertFalse(reader.cache)

    def test_mismatched_content_range_is_rejected_before_body(self):
        for content_range in ('bytes 1-8/50', 'bytes 0-7/51', 'bytes 0-49/50', 'missing'):
            with self.subTest(content_range=content_range):
                reader, session = self.reader(overrides=[{'headers': {'Content-Range': content_range}}])
                with self.assertRaisesRegex(ValueError, 'inconsistent byte range'):
                    reader.read(1)
                self.assertFalse(session.responses[0].body_consumed)
                self.assertTrue(session.responses[0].closed)
                self.assertEqual(reader.transferred, 0)

    def test_changed_etag_is_rejected_before_second_body(self):
        reader, session = self.reader(overrides=[{}, {'headers': {'ETag': 'version-two'}}])
        self.assertEqual(reader.read(8), bytes(range(8)))
        with self.assertRaisesRegex(ValueError, 'source changed'):
            reader.read(1)
        self.assertEqual(session.calls[1]['headers']['If-Match'], 'version-one')
        self.assertFalse(session.responses[1].body_consumed)
        self.assertTrue(session.responses[1].closed)
        self.assertEqual(reader.transferred, 8)


if __name__ == '__main__':
    unittest.main()
