num = int(input("Enter a number between 1-10: "))

while num < 0 or num > 10:
    print(f"{num} is invalid")
    num = int(input("Enter a number between 1-10: "))

print(f"your number is {num}")
