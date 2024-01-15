import os

from tkinter import Tk
from Model.Song import Song
from Views.search_folder import SearchFolder

from Utils import commands



root = Tk()

opts= {
    'title' : 'Convertir Canciones 2'
}

searchFolder = SearchFolder(root , opts)

searchFolder.execute_view()

root.mainloop()


path , option=  commands.menu()



song_model = Song(path)

contents = os.listdir(path)
songs = []
for song in contents:

    preview_song = song
    song = song.replace("'", "_")

    if(song != preview_song):
        song_model.set_original_name(preview_song, song)

    if os.path.isfile(os.path.join(path, song)) and song.endswith('.mp3'):
        print("song: {}".format(song))
        if option == 'mix':

            dataSong = song_model.search_by_name(song)
            if len(dataSong) > 0:
                print("Song exits!!!")
                song_model.renew_alias_by_name(song)
            else:
                dataSong = song_model.search_by_alias(song)
                if len(dataSong) > 0:
                    print("Alias exist!!!")
                    song_model.renew_alias(song)
                    print("Alias Renew...")
                else:
                    print("song alias not found")
                    print("Song not found...")
                    print("Create alias...")
                    song_model.create_alias(song)

        elif option == 'original':
            dataSong = song_model.search_by_name(song)
            if len(dataSong) > 0:
                print("Song exits!!!")
            else:
                dataSong = song_model.search_by_alias(song)
                if len(dataSong) > 0:
                    print("Alias exist!!!")
                    print(dataSong)
                    song_model.set_original_name(
                        dataSong[0][1], dataSong[0][0])
                else:
                    print("song alias and name not found")
print("Goodbye my friend...")



