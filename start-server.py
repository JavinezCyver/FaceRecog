import http.server
import os
import socketserver
import webbrowser


PORT = 8081
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)


def main():
    os.chdir(ROOT)
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/facerecog.html"
        print(f"Serving {ROOT} at {url}")
        print("Keep this window open. Press Ctrl+C to stop.")
        try:
          webbrowser.open(url)
        except Exception:
          pass
        httpd.serve_forever()


if __name__ == "__main__":
    main()
