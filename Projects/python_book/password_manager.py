# functions
def add():
    name = input("name of the account: ")
    password = input("password of the acccount: ")
    with open("passwords.txt", "a") as f:
        f.write(name + "|" + password + "\n")


def view():
    with open("passwords.txt", "r") as f:
        for line in f:
            data = line.rstrip()
            user, passw = data.split("|")
            print("User:", user, "Passwords", passw)


while True:
    mode = input(
        "would you like to view your password or add new ones(add/view/quit): "
    ).lower()
    if mode == "view":
        view()
    elif mode == "add":
        add()
    elif mode == "quit":
        break
    else:
        print("invalid mode")
