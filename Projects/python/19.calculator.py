operator = input("enter your operator (+,-,*,/): ")
num1 = float(input("enter the 1st number: "))
num2 = float(input("enter the 2nd number: "))

if operator == "+":
    result = num1 + num2
    print(round(result, 2))
elif operator == "-":
    result = num1 - num2
    print(round(result, 2))
elif operator == "*":
    result = num1 * num2
    print(round(result, 2))
elif operator == "/":
    result = num1 / num2
    print(round(result, 2))
else:
    print("invalid")
