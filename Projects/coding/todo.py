import json
from pathlib import Path

file_path = Path("todo.json")


def add():
    text_task = input("add you task: ")
    new_task = {"task": text_task, "done": False}

    if file_path.exists():
        with open("todo.json", "r") as f:
            tasks = json.load(f)
    else:
        tasks = []

    tasks.append(new_task)

    with open("todo.json", "w") as f:
        json.dump(tasks, f, indent=4)

    print("task sucesfully saved")


def view():
    if file_path.exists():
        with open("todo.json", "r") as f:
            tasks = json.load(f)
    else:
        tasks = []

    print("\n---your-to-do-list---")
    for task in tasks:
        print(f"[ ] {task['task']}")


while True:
    mode = input("Select the mode (add/view/quit): ").lower()
    if mode == "add":
        add()
    elif mode == "view":
        view()
    elif mode == "quit":
        break
    else:
        print("invalid mode")
