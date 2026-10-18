import cv2

# 1. Read the input image from disk
image_path = "/home/sam/Pictures/catto.jpg"
img = cv2.imread(image_path)

# 2. Safety check: Verify the image was found and loaded correctly
assert img is not None, "Could not read the file. Check if the path is correct!"

# 3. Optional: Display the image in a window
cv2.imshow("Input Image", img)

# 4. Keep the window open until you press any key
cv2.waitKey(0)
cv2.destroyAllWindows()
