import json
from pathlib import Path

 file_path = Path("bookmark.json")


def add():
    url = input("what is the url: ")
    title = input("what is the title: ")
    data = {"URL": url, "Title": title}

    if file_path.exists():
        with open(file_path, "r") as f:
            bookmarks = json.load(f)
    else:
        bookmarks = []

    bookmarks.append(data)

    with open(file_path, "w") as f:
        json.dump(bookmarks, f, indent=4)

    print("bookmark saved")


add()
