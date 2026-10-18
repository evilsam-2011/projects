data = input("sides of square: ")
raw_sides = []
sides = [item for item in raw_sides if item != " "]
square = []
for i in data:
    sides.append(i)


for x in sides:
    if sides[0] == x:
        square.append("yes")
    else:
        square.append("no")

if square[2] == "yes":
    print("yes")
else:
    print("no")
