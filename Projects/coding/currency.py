import requests

# getting user input
base = input("what is the base currency: ")
output = input("what do you want to convert this to: ")
amount = float(input("what amount do you want to convert: "))


# fetching data from api
url = f"https://api.frankfurter.dev/v1/latest?amount={amount}&from={base}&to={output}"
response = requests.get(url)
data = response.json()

converted_amount = data["rates"]

print(converted_amount)
