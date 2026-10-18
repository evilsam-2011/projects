import pygame

pygame.init()
screen = pygame.display.set_mode((1280, 720))
running = True

while running:
    for even in pygame.event.get():
        if even.type == pygame.QUIT:
            running - False

    screen.fill("purple")
