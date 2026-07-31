import argparse
import statistics
import sys
import time
from urllib import request


def check_url(base_url, path, requests_per_path):
    durations = []
    url = f"{base_url.rstrip('/')}{path}"
    for _ in range(requests_per_path):
        started = time.perf_counter()
        with request.urlopen(url, timeout=5) as response:
            response.read()
            if response.status >= 500:
                raise AssertionError(f"{url} returned {response.status}")
        durations.append((time.perf_counter() - started) * 1000)
    return durations


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:5001")
    parser.add_argument("--requests", type=int, default=3)
    parser.add_argument("--max-average-ms", type=float, default=750)
    parser.add_argument(
        "paths",
        nargs="*",
        default=["/", "/api/portfolios"],
    )
    args = parser.parse_args()

    all_durations = []
    for path in args.paths:
        all_durations.extend(check_url(args.base_url, path, args.requests))

    average = statistics.mean(all_durations)
    print(f"Average response time: {average:.2f} ms")
    if average > args.max_average_ms:
        print(
            f"Average exceeded {args.max_average_ms:.2f} ms threshold",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
