unit = input("what will be the unit of the temprature celsius or fahrenheit (C/F): ")
temp = float(input("enter the temprature: "))

if unit == "C":
    temp = round((9 * temp) / 5 + 32, 1)
    print(f"the temprature in fahrenheit is {temp}")
elif unit == "F":
    temp = round((temp - 32) * 5 / 9, 1)
    print(f"the temprature in celsius is {temp}")
else:
    print(f"{unit} is invalid unit")
