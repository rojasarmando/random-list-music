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
        
        self.option = 'Original'
        
        self.options = ["Original", "Mix"]

    
    def execute_view(self):
        tt.screen(self.root, self.title)

        frame = Frame(self.root)
        frame.pack()

        bottomframe = Frame(self.root)
        bottomframe.pack(side=TOP, expand=YES)

        bottomframe2 = Frame(self.root)
        bottomframe2.pack(side=TOP, expand=YES)
        
        bottomframe3 = Frame(self.root)
        bottomframe3.pack(side=TOP, expand=YES)


        E = Entry(bottomframe, textvariable=self.folderPath, width=40)
        E.grid(row=0, column=0)

        btnFind = ttk.Button(bottomframe2, text="Buscar Carpeta",
                            command=self.getFolderPath)
        btnFind.grid(row=1, column=0)

        btnExecute = ttk.Button(bottomframe2, text="Ejecutar", command=self.execute_mix_music)
        btnExecute.grid(row=1, column=1)
        
        self.option = StringVar(bottomframe2)
        
        self.option.set(self.options[0])
        
        lista_deploy = OptionMenu(bottomframe2, self.option, *self.options, command=self.select_option)
        lista_deploy.grid(row=1, column=3)
        #lista_deploy.pack(frame=bottomframe2)
        
        
    def getFolderPath(self):
        folder_selected = filedialog.askdirectory()
        self.folderPath.set(folder_selected)
        print(self.folderPath.get())
        
    def execute_mix_music(self):
        pass
    
    def select_option(self , event):
        self.opt = self.option.get()
        print("Opción seleccionada:", self.opt)
        
        
    def destroy_windows(self):
        self.root.destroy()
        
    
        
