from tkinter import filedialog

def screen(root, title):
    
    width = 700  # Width
    height = 200  # Height

    screen_width = root.winfo_screenwidth()  # Width of the screen
    screen_height = root.winfo_screenheight()  # Height of the screen

    x = (screen_width/2) - (width/2)
    y = (screen_height/2) - (height/2)

    root.title(title)
    root.geometry('%dx%d+%d+%d' % (width, height, x, y))
    root.resizable(False, False)
