num = -1
a = 5
b = 10
age = 19
temprature = 21
user_role = "admin"

# print("positive" if num > 0 else "negative")
# result = "EVEN" if num % 2 == 0 else "ODD"
# max_num = a if a > b else b
# min_num = a if a < b else b
# status = "ADULT" if age >= 18 else "CHILD"
# weather = "hot" if temprature > 20 else "cold"
access_level = "Full access" if user_role == "admin" else "Limited access"
print(access_level)
