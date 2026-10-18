import curses
import subprocess
import shutil
import filecmp
import argparse
import json
from pathlib import Path


def folder():
    folder_path = Path("~/.dotfiles").expanduser()
    if folder_path.is_dir():
        print("fodler exists")
        mode()
    else:
        create = input("do you want to create a fodler in order to you this(yes/no): ")
        if create == "yes":
            folder_path.mkdir(parents=True, exist_ok=True)
        else:
            quit


def mode():
    while True:
        mode = input(
            "what do you want to do\n1.commit\n2.add folders\n3.log\n4.quit\n(1/2/3/4)\n: "
        )
        if mode == "1":
            pass
        elif mode == "2":
            pass
        elif mode == "3":
            pass
        elif mode == "4":
            break
        else:
            continue


def add_folder():
    while True:
        folders = input("what folders from .config you want to track/ q to quit: ")
        if folders == "q":
            break
        else:
            with open("dotfiles.json", "a") as file:
                json.dump(folders, file, + "\n")


add_folder()
