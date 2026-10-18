name = input("what is your name: ")

while name == "":
    print("you did not enter your name")
    name = input("what is your name: ")

print(f"welcome {name}")
