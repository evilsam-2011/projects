print("welcome to my quiz game")

playing = input("do you want to play this quiz: ").lower()

if playing != "yes":
    quit()

print("okay nice lets start playing")
score = 0
# Question no.1
answer = input("what does CPU stand for?: ").lower()

if answer == "central processing unit":
    print("Correct!!")
    score += 1
else:
    print("Wrong!!")

# Question no.2
answer = input("what does GPU stand for?: ").lower()

if answer == "graphics processing unit":
    print("Correct!!")
    score += 1
else:
    print("Wrong!!")


answer = input("what does RAM stand for?: ").lower()

if answer == "random access memory":
    print("Correct!!")
    score += 1
else:
    print("Wrong!!")

answer = input("what does ROM stand for?: ").lower()

if answer == "read only memory":
    print("Correct!!")
    score += 1
else:
    print("Wrong!!")

print(f"your score is (score)")



