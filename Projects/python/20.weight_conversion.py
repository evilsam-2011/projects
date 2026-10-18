weight = float(input("enter your weight: "))
unit = input("enter your input (K or L ): ")

if unit == "K":
    weight = weight * 2.205
    unit = "pounds"
    print(f"your weight {round(weight, 1)}{unit}")
elif unit == "L":
    weight = weight / 2.205
    unit = "kilogram"
    print(f"your weight {round(weight, 1)}{unit}")
else:
    print("that is invalid")
