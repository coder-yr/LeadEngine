from bullmq import Worker
import sys

def main():
    print(Worker.__init__.__code__.co_varnames)
    try:
        w = Worker("test", lambda x: print(x))
        print("Worker prefix:", getattr(w, "prefix", "UNKNOWN"))
        print("Worker opts:", getattr(w, "opts", "UNKNOWN"))
        w.close()
    except Exception as e:
        print(e)
main()
