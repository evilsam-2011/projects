name = input("Enter your username: ")

if len(name) > 12:
    print("your username should not contain more that 12 characters")
elif not name.find(" ") == -1:
    print("your username should not contain space")
elif not name.isalpha():
    print("username should not contain digits ")
else:
    print(f"welcome {name}")
