import shutil
from pathlib import Path

dir = "/home/sam/test/"
text = "/home/sam/test/text/"
images = "/home/sam/test/images/"
videos = "/home/sam/test/videos/"

for path in Path(dir).iterdir():
    if path.suffix == ".md" or path.suffix == ".txt":
        if Path(text).is_dir():
            shutil.move(path, text)
        else:
            Path(text).mkdir()
            shutil.move(path, text)
    elif path.suffix == ".png":
        if Path(images).is_dir():
            shutil.move(path, images)
        else:
            Path(images).mkdir()
            shutil.move(path, images)
    elif path.suffix == ".mp4":
        if Path(videos).is_dir():
            shutil.move(path, videos)
        else:
            Path(videos).mkdir()
            shutil.move(path, videos)
