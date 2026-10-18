age = int(input("enter your age: "))

while age < 0:
    print("age cannot be negative")
    age = int(input("enter your age: "))

print(f"your age is {age}")
