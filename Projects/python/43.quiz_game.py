questions = (
    "What is the capital of France?: ",
    "What is the largest planet?: ",
    "What is the smallest planet?: ",
)

options = (
    ("A.Paris", "B.London", "C.Berlin", "D.Madrid"),
    ("A.Jupiter", "B.Saturn", "C.Uranus", "D.Neptune"),
    ("A.Mercury", "B.Venus", "C.Earth", "D.Mars"),
)

answers = ("A", "A", "A")
guesses = []
score = 0
question_num = 0

for question in questions:
    print("-----------------------------------")
    print(question)
    for option in options[question_num]:
        print(option)
    guess = input("Entel (A, B, C, D): ").upper()
    guesses.append(guess)
    if guess == answers[question_num]:
        score += 1
        print("CORRECT")
    else:
        print("INCORRECT")
        print(f"The correct answer is {answers[question_num]}")
    question_num += 1


print("-----------------------------------")
print("              RESULTS              ")
print("-----------------------------------")

for answer in answers:
    print(answer, end=" ")
print()

for guess in guesses:
    print(guess, end=" ")
print()

score = int(score / len(questions) * 100)
print(f"Your score is {score}%")
