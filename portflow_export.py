import sys

def main():
    if "--cli" in sys.argv:
        from portflow_exporter.app import main as cli_main
        cli_main()
    else:
        from portflow_exporter.web import start_server
        start_server()

if __name__ == "__main__":
    main()
