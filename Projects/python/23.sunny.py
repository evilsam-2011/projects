temp = 28
is_sunny = False

if temp >= 28 and is_sunny:
    print("It is hot outside")
    print("it is sunny outside")
elif temp <= 0 and is_sunny:
    print("it is cold outside")
    print("it is sunny outside")
elif 28 > temp > 0 and is_sunny:
    print("it is warm outside")
    print("it is sunny outside")
elif temp >= 28 and not is_sunny:
    print("It is hot outside")
    print("it is cloudy outside")
elif temp <= 0 and not is_sunny:
    print("it is cold outside")
    print("it is cloudy outside")
elif 28 > temp > 0 and not is_sunny:
    print("it is warm outside")
    print("it is cloudy outside")
