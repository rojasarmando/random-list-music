import random
import string
import os

from Model.Connection import Connection


class Song(Connection):
    def __init__(self, path):
        self.path = path
        super().__init__(path + '/playlist.ar')
        self.create_table_name()

    def create_table_name(self):
        try:
            sql = ''' 
            CREATE TABLE SONGS (
                NAME TEXT NOT NULL,
                ALIAS TEXT NULL
            ) 
            '''
            self.execute(sql)
            print('DB created')
        except:
            print('DB exists')

    def search_by_alias(self, alias):
        data = self.execute("SELECT * FROM SONGS WHERE ALIAS = '{}'".format(alias))
        return data

    def search_by_name(self, name):
        data = self.execute("SELECT * FROM SONGS WHERE NAME = '{}'".format(name))
        return data

    def create_alias(self, name):
        alias = self.new_alias()
        os.rename(self.path + '/' + name, self.path + '/' + alias)
        return self.execute("INSERT INTO SONGS (NAME , ALIAS) VALUES ('{}' , '{}')".format(name, alias))

    def renew_alias(self, old_alias):
        alias = self.new_alias()
        os.rename(self.path + '/' + old_alias, self.path + '/' + alias)
        return self.execute("UPDATE SONGS SET ALIAS='{}' WHERE ALIAS = '{}'".format(alias, old_alias))

    def renew_alias_by_name(self, name):
        alias = self.new_alias()
        os.rename(self.path + '/' + name, self.path + '/' + alias)
        return self.execute("UPDATE SONGS SET  ALIAS = '{}' WHERE NAME = '{}'".format(alias, name))

    def set_original_name(self, alias , name):
        os.rename(self.path + '/' + alias, self.path + '/' + name)

    def new_alias(self):
        control = True
        alias = ''
        while control:
            alias = ''.join(random.sample(string.ascii_lowercase, 20)) + '.mp3'
            data = self.execute("SELECT ALIAS FROM SONGS WHERE ALIAS = '{}'".format(alias))
            if len(data) < 1:
                control = False
        return alias
