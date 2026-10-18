# imports
import json
from pathlib import Path

file_path = Path("expense.json")

# functions


def add():
    text_expense = input("Add the item: ")
    price = input("enter its price: ")

    new_expense = {"item": text_expense, "price": price}
    if file_path.exists():
        with open(file_path, "r") as f:
            expenses = json.load(f)
    else:
        expenses = []

    expenses.append(new_expense)

    with open(file_path, "w") as f:
        json.dump(expenses, f, indent=4)

    print("expense saved sucessfully")


def view():
    if file_path.exists():
        with open(file_path, "r") as f:
            expenses = json.load(f)
    else:
        print("noting is saved")
        expenses = []

    print("\n---expenses---")
    for expense in expenses:
        print(f"item:{expense['item']} price:{expense['price']}")


while True:
    mode = input("what mode do you want to select(add/view/clear/quit): ")
    if mode == "add":
        add()
    elif mode == "view":
        view()
    elif mode == "clear":
        if file_path.exists():
            file_path.unlink()
            print("file cleared")
        else:
            print("no file to clear")
    elif mode == "quit":
        break
    else:
        print("invalid mode")
