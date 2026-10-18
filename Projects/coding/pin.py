while True:
    code = input("enter a 3 digit code: ")
    if code.isdigit():
        if len(code) != 3:
            print("you can only enter a 3 digit number")
        else:
            code = int(code)
            break
    else:
        print("enter a number")

for i in range(10):
    print(i)
