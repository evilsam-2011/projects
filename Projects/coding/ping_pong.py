import pygame

pygame.init()

screen = pygame.display.set_mode((800, 600))
pygame.display.set_caption("ping pong")

screen.fill((0, 0, 0))
font = pygame.font.Font(None, 36)
text_surface = font.render("Hello world", True, (225, 225, 225))
