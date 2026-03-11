import uvicorn
import webbrowser
import multiprocessing
import time

def run_server():
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)

if __name__ == "__main__":
    p = multiprocessing.Process(target=run_server)
    p.start()

    time.sleep(1)
    webbrowser.open("http://127.0.0.1:8000/login")
