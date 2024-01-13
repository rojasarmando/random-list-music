from tkinter import *
from tkinter import ttk
from tkinter import filedialog
from Utils import tools as tt


class SearchFolder:
    
    def __init__(self , root , opts=None) -> None:
        self.root = root
        self.set_default()
        
        if not opts:
            opts = {}
        
        if "title" in opts:
            self.title = opts['title'] 
     
    
    def set_default(self):
        """
        Set the default values for the object.

        Parameters:
            None

        Returns:
            None
        """
        
        self.title = "Convertir Canciones"
        self.folderPath = StringVar()
    
    def execute_view(self):
        tt.screen(self.root, self.title)

        frame = Frame(self.root)
        frame.pack()

        bottomframe = Frame(self.root)
        bottomframe.pack(side=TOP, expand=YES)

        bottomframe2 = Frame(self.root)
        bottomframe2.pack(side=TOP, expand=YES)


        E = Entry(bottomframe, textvariable=self.folderPath, width=40)
        E.grid(row=0, column=0)

        btnFind = ttk.Button(bottomframe2, text="Buscar Carpeta",
                            command=self.getFolderPath)
        btnFind.grid(row=1, column=0)

        btnExecute = ttk.Button(bottomframe2, text="Ejecutar", command=self.execute_mix_music)
        btnExecute.grid(row=1, column=1)
        
    def getFolderPath(self):
        folder_selected = filedialog.askdirectory()
        self.folderPath.set(folder_selected)
        
        
    def execute_mix_music(self):
        pass
        
    
        

def execute_view(root):
    tt.screen(root, "Convertir Canciones")

    frame = Frame(root)
    frame.pack()

    bottomframe = Frame(root)
    bottomframe.pack(side=TOP, expand=YES)

    bottomframe2 = Frame(root)
    bottomframe2.pack(side=TOP, expand=YES)


    folderPath = StringVar()
    E = Entry(bottomframe, textvariable=folderPath, width=40)
    E.grid(row=0, column=0)

    btnFind = ttk.Button(bottomframe2, text="Buscar Carpeta",
                        command=tt.getFolderPath)
    btnFind.grid(row=1, column=0)

    btnExecute = ttk.Button(bottomframe2, text="Ejecutar", command=tt.getFolderPath)
    btnExecute.grid(row=1, column=1)