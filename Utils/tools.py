

from tkinter import filedialog

def getFolderPath(folderPath):
    folder_selected = filedialog.askdirectory()
    folderPath.set(folder_selected)
    


def screen(root, title):
    
    width = 300  # Width
    height = 100  # Height

    screen_width = root.winfo_screenwidth()  # Width of the screen
    screen_height = root.winfo_screenheight()  # Height of the screen

    x = (screen_width/2) - (width/2)
    y = (screen_height/2) - (height/2)

    root.title(title)
    root.geometry('%dx%d+%d+%d' % (width, height, x, y))
    root.resizable(False, False)
